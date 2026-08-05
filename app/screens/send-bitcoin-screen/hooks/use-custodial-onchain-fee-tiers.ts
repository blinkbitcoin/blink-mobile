import { useCallback, useEffect, useRef, useState } from "react"

import { gql } from "@apollo/client"

import {
  type OnChainTxFeeBySpeedQuery,
  type OnChainUsdTxFeeAsBtcDenominatedBySpeedQuery,
  type OnChainUsdTxFeeBySpeedQuery,
  PayoutSpeed,
  useOnChainTxFeeBySpeedLazyQuery,
  useOnChainUsdTxFeeAsBtcDenominatedBySpeedLazyQuery,
  useOnChainUsdTxFeeBySpeedLazyQuery,
} from "@app/graphql/generated"

import { reportError } from "@app/utils/error-logging"

import { OnchainFeeQuote } from "../payment-details/index.types"

import {
  buildZeroTiers,
  FeeTierOption,
  FeeUnit,
  type FeeTierInfo,
} from "./fee-tiers.types"

export const PAYOUT_SPEED_BY_FEE_TIER: Record<FeeTierOption, PayoutSpeed> = {
  [FeeTierOption.Fast]: PayoutSpeed.Fast,
  [FeeTierOption.Medium]: PayoutSpeed.Medium,
  [FeeTierOption.Slow]: PayoutSpeed.Slow,
}

/**
 * Mirrors the broadcast windows the backend advertises for each payout queue
 * (`payoutSpeeds` in galoy-values): Priority ~10 minutes, Standard ~1 hour and
 * Flexible ~24 hours. Self-custodial sends broadcast straight from the SDK rather
 * than through those queues, so they keep their own estimates in FEE_TIER_ETA_MINUTES.
 */
export const CUSTODIAL_PAYOUT_ETA_MINUTES: Record<FeeTierOption, number> = {
  [FeeTierOption.Fast]: 10,
  [FeeTierOption.Medium]: 60,
  [FeeTierOption.Slow]: 1440,
}

/**
 * One request per quote rather than three: the selector needs every tier at once, and the
 * aliases let a single round trip answer for all of them.
 */
gql`
  query onChainTxFeeBySpeed(
    $walletId: WalletId!
    $address: OnChainAddress!
    $amount: SatAmount!
  ) {
    fast: onChainTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: FAST
    ) {
      amount
    }
    medium: onChainTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: MEDIUM
    ) {
      amount
    }
    slow: onChainTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: SLOW
    ) {
      amount
    }
  }

  query onChainUsdTxFeeBySpeed(
    $walletId: WalletId!
    $address: OnChainAddress!
    $amount: CentAmount!
  ) {
    fast: onChainUsdTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: FAST
    ) {
      amount
    }
    medium: onChainUsdTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: MEDIUM
    ) {
      amount
    }
    slow: onChainUsdTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: SLOW
    ) {
      amount
    }
  }

  query onChainUsdTxFeeAsBtcDenominatedBySpeed(
    $walletId: WalletId!
    $address: OnChainAddress!
    $amount: SatAmount!
  ) {
    fast: onChainUsdTxFeeAsBtcDenominated(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: FAST
    ) {
      amount
    }
    medium: onChainUsdTxFeeAsBtcDenominated(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: MEDIUM
    ) {
      amount
    }
    slow: onChainUsdTxFeeAsBtcDenominated(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: SLOW
    ) {
      amount
    }
  }
`

/** Only a USD wallet quoting in cents departs from sats, and only for the cents endpoint. */
const FEE_UNIT_BY_QUOTE: Record<OnchainFeeQuote, FeeUnit> = {
  [OnchainFeeQuote.Btc]: FeeUnit.Sats,
  [OnchainFeeQuote.Usd]: FeeUnit.Cents,
  [OnchainFeeQuote.UsdAsBtcDenominated]: FeeUnit.Sats,
}

const EMPTY_TIERS = Object.freeze(
  buildZeroTiers(CUSTODIAL_PAYOUT_ETA_MINUTES, FeeUnit.Sats),
)

/** The three queries differ only in the fee type they resolve to, so one mapper serves all. */
type FeeBySpeedData =
  | OnChainTxFeeBySpeedQuery
  | OnChainUsdTxFeeBySpeedQuery
  | OnChainUsdTxFeeAsBtcDenominatedBySpeedQuery

const toTiers = (
  data: FeeBySpeedData,
  feeUnit: FeeUnit,
): Record<FeeTierOption, FeeTierInfo> => ({
  [FeeTierOption.Fast]: {
    feeAmount: data.fast.amount,
    feeUnit,
    etaMinutes: CUSTODIAL_PAYOUT_ETA_MINUTES[FeeTierOption.Fast],
  },
  [FeeTierOption.Medium]: {
    feeAmount: data.medium.amount,
    feeUnit,
    etaMinutes: CUSTODIAL_PAYOUT_ETA_MINUTES[FeeTierOption.Medium],
  },
  [FeeTierOption.Slow]: {
    feeAmount: data.slow.amount,
    feeUnit,
    etaMinutes: CUSTODIAL_PAYOUT_ETA_MINUTES[FeeTierOption.Slow],
  },
})

type CustodialOnchainFeeTiersParams = {
  walletId: string | undefined
  address: string | undefined
  amount: number | undefined
  quote: OnchainFeeQuote | undefined
}

type CustodialOnchainFeeTiersResult = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  hasError: boolean
  isQuoting: boolean
}

export const useCustodialOnchainFeeTiers = ({
  walletId,
  address,
  amount,
  quote,
}: CustodialOnchainFeeTiersParams): CustodialOnchainFeeTiersResult => {
  const [tiers, setTiers] = useState(EMPTY_TIERS)
  const [hasError, setHasError] = useState(false)
  const [isQuoting, setIsQuoting] = useState(false)
  // Discards stale resolutions when the amount or destination changes mid-flight.
  const requestTokenRef = useRef(0)

  const [fetchBtcFees] = useOnChainTxFeeBySpeedLazyQuery({ fetchPolicy: "no-cache" })
  const [fetchUsdFees] = useOnChainUsdTxFeeBySpeedLazyQuery({ fetchPolicy: "no-cache" })
  const [fetchUsdAsBtcFees] = useOnChainUsdTxFeeAsBtcDenominatedBySpeedLazyQuery({
    fetchPolicy: "no-cache",
  })

  const fetchFees = useCallback(async () => {
    requestTokenRef.current += 1
    const token = requestTokenRef.current
    // Clear upfront so a failure from a previous amount does not outlive its own retry.
    setHasError(false)

    if (!walletId || !address || !amount || !quote) {
      setTiers(EMPTY_TIERS)
      setIsQuoting(false)
      return
    }

    const variables = { walletId, address, amount }
    const fetchFeesForQuote = {
      [OnchainFeeQuote.Btc]: fetchBtcFees,
      [OnchainFeeQuote.Usd]: fetchUsdFees,
      [OnchainFeeQuote.UsdAsBtcDenominated]: fetchUsdAsBtcFees,
    }[quote]

    /**
     * Dropped alongside the flag so the selector never pairs the previous amount's fee with
     * the amount now on screen; it shows the tier name and a spinner until this one lands.
     */
    setTiers(EMPTY_TIERS)
    setIsQuoting(true)

    try {
      const { data } = await fetchFeesForQuote({ variables })
      if (token !== requestTokenRef.current) return
      if (!data) throw new Error("Missing on-chain fee data")

      setTiers(toTiers(data, FEE_UNIT_BY_QUOTE[quote]))
      setHasError(false)
    } catch (err) {
      if (token !== requestTokenRef.current) return
      reportError("use-custodial-onchain-fee-tiers", err)
      setTiers(EMPTY_TIERS)
      setHasError(true)
    } finally {
      if (token === requestTokenRef.current) setIsQuoting(false)
    }
  }, [walletId, address, amount, quote, fetchBtcFees, fetchUsdFees, fetchUsdAsBtcFees])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  return { tiers, hasError, isQuoting }
}
