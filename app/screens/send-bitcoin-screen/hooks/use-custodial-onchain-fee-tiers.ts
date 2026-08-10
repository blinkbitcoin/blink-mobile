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
import { useQuoteStatus } from "./use-quote-status"

export const PAYOUT_SPEED_BY_FEE_TIER: Record<FeeTierOption, PayoutSpeed> = {
  [FeeTierOption.Fast]: PayoutSpeed.Fast,
  [FeeTierOption.Medium]: PayoutSpeed.Medium,
  [FeeTierOption.Slow]: PayoutSpeed.Slow,
}

/**
 * Mirrors the broadcast windows the backend advertises for each payout queue
 * (`payoutSpeeds` in galoy-values): Priority ~10 minutes, Standard ~4 hours and
 * Flexible ~24 hours. Standard moved off bria's half-hour queue in blink-deployments#10052,
 * so anything shorter now under-promises. Self-custodial sends broadcast straight from the
 * SDK rather than through those queues, so they keep their own FEE_TIER_ETA_MINUTES.
 */
export const CUSTODIAL_PAYOUT_ETA_MINUTES: Record<FeeTierOption, number> = {
  [FeeTierOption.Fast]: 10,
  [FeeTierOption.Medium]: 240,
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

/** Object.freeze stops at the record, so each tier is frozen in turn to match the promise. */
Object.values(EMPTY_TIERS).forEach((tier) => Object.freeze(tier))

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
  hasQuote: boolean
  isQuoting: boolean
}

export const useCustodialOnchainFeeTiers = ({
  walletId,
  address,
  amount,
  quote,
}: CustodialOnchainFeeTiersParams): CustodialOnchainFeeTiersResult => {
  const [tiers, setTiers] = useState(EMPTY_TIERS)
  /** Null until every input a quote needs is in hand, which is what gates the fetch below. */
  const inputsKey =
    walletId && address && amount && quote
      ? `${walletId}|${address}|${amount}|${quote}`
      : null
  const { hasQuote, hasFailed, isQuoting, discardQuote, markQuoted, markFailed } =
    useQuoteStatus(inputsKey)
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
    // Whatever was quoted stops applying the moment this runs, request or gate alike.
    discardQuote()

    if (!walletId || !address || !amount || !quote) {
      setTiers(EMPTY_TIERS)
      return
    }

    const variables = { walletId, address, amount }
    const fetchFeesForQuote = {
      [OnchainFeeQuote.Btc]: fetchBtcFees,
      [OnchainFeeQuote.Usd]: fetchUsdFees,
      [OnchainFeeQuote.UsdAsBtcDenominated]: fetchUsdAsBtcFees,
    }[quote]

    // Dropped so a failure never leaves the previous amount's fee behind to be re-quoted onto.
    setTiers(EMPTY_TIERS)

    try {
      const { data } = await fetchFeesForQuote({ variables })
      if (token !== requestTokenRef.current) return
      if (!data) throw new Error("Missing on-chain fee data")

      setTiers(toTiers(data, FEE_UNIT_BY_QUOTE[quote]))
      markQuoted()
    } catch (err) {
      if (token !== requestTokenRef.current) return
      reportError("use-custodial-onchain-fee-tiers", err)
      setTiers(EMPTY_TIERS)
      markFailed()
    }
  }, [
    walletId,
    address,
    amount,
    quote,
    fetchBtcFees,
    fetchUsdFees,
    fetchUsdAsBtcFees,
    discardQuote,
    markQuoted,
    markFailed,
  ])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  return { tiers, hasError: hasFailed, hasQuote, isQuoting }
}
