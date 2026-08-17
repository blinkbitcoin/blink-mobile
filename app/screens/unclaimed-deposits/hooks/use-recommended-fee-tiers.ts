import { useCallback, useEffect, useRef, useState } from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { getRecommendedFees } from "@app/self-custodial/bridge"

import {
  classifySdkFeeError,
  ETA_MINUTES,
  SdkFeeError,
} from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"
import {
  buildZeroTiers,
  FeeUnit,
  type FeeTierInfo,
  FeeTierOption,
  FeeTierOption as Tier,
} from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { useQuoteStatus } from "@app/screens/send-bitcoin-screen/hooks/use-quote-status"

const DEFAULT_TIERS = buildZeroTiers(ETA_MINUTES, FeeUnit.SatPerVbyte)

type RecommendedFeeTiersResult = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  error: SdkFeeError | null
  hasQuote: boolean
}

/**
 * The rates are network-wide rather than per payment, so being enabled is the whole of what
 * a quote depends on and one constant stands in for the inputs the other rails key on.
 */
const RECOMMENDED_FEES_KEY = "recommended-fees"

export const useRecommendedFeeTiers = (
  sdk: BreezSdkInterface | null,
  enabled: boolean,
): RecommendedFeeTiersResult => {
  const [tiers, setTiers] = useState(DEFAULT_TIERS)
  /** Holds only the reason; whether it still applies is decided by the keyed failure flag. */
  const [failureReason, setFailureReason] = useState<SdkFeeError | null>(null)
  const inputsKey = sdk && enabled ? RECOMMENDED_FEES_KEY : null
  const { hasQuote, hasFailed, discardQuote, markQuoted, markFailed } =
    useQuoteStatus(inputsKey)
  // Discards stale resolutions when refund mode is toggled mid-flight.
  const requestTokenRef = useRef(0)

  const error = hasFailed ? failureReason : null

  const fetchFees = useCallback(async () => {
    requestTokenRef.current += 1
    const token = requestTokenRef.current
    // The rates go with the quote, so a caller reading tiers cannot see a discarded rate.
    discardQuote()
    setTiers(DEFAULT_TIERS)

    if (!sdk || !enabled) return

    try {
      const rates = await getRecommendedFees(sdk)
      if (token !== requestTokenRef.current) return

      setTiers({
        [Tier.Fast]: {
          feeAmount: rates.fastest,
          feeUnit: FeeUnit.SatPerVbyte,
          etaMinutes: ETA_MINUTES[Tier.Fast],
        },
        [Tier.Medium]: {
          feeAmount: rates.halfHour,
          feeUnit: FeeUnit.SatPerVbyte,
          etaMinutes: ETA_MINUTES[Tier.Medium],
        },
        [Tier.Slow]: {
          feeAmount: rates.economy,
          feeUnit: FeeUnit.SatPerVbyte,
          etaMinutes: ETA_MINUTES[Tier.Slow],
        },
      })
      markQuoted()
    } catch (err) {
      if (token !== requestTokenRef.current) return
      setFailureReason(classifySdkFeeError(err))
      markFailed()
    }
  }, [sdk, enabled, discardQuote, markQuoted, markFailed])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  return { tiers, error, hasQuote }
}

export const getFeeRateSatPerVb = (
  tiers: Record<FeeTierOption, FeeTierInfo>,
): Record<FeeTierOption, number> => ({
  [Tier.Fast]: tiers[Tier.Fast].feeAmount,
  [Tier.Medium]: tiers[Tier.Medium].feeAmount,
  [Tier.Slow]: tiers[Tier.Slow].feeAmount,
})
