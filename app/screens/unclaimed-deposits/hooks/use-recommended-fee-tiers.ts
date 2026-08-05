import { useCallback, useEffect, useState } from "react"

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

const DEFAULT_TIERS = buildZeroTiers(ETA_MINUTES, FeeUnit.SatPerVbyte)

type RecommendedFeeTiersResult = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  error: SdkFeeError | null
  isQuoting: boolean
}

export const useRecommendedFeeTiers = (
  sdk: BreezSdkInterface | null,
  enabled: boolean,
): RecommendedFeeTiersResult => {
  const [tiers, setTiers] = useState(DEFAULT_TIERS)
  const [error, setError] = useState<SdkFeeError | null>(null)
  /** True from the first render when a quote is already due, so no frame claims a zero rate. */
  const [isQuoting, setIsQuoting] = useState(() => Boolean(sdk && enabled))

  const fetchFees = useCallback(async () => {
    if (!sdk || !enabled) {
      setError(null)
      setIsQuoting(false)
      return
    }

    setIsQuoting(true)

    try {
      const rates = await getRecommendedFees(sdk)
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
      setError(null)
    } catch (err) {
      setError(classifySdkFeeError(err))
    } finally {
      setIsQuoting(false)
    }
  }, [sdk, enabled])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  return { tiers, error, isQuoting }
}

export const getFeeRateSatPerVb = (
  tiers: Record<FeeTierOption, FeeTierInfo>,
): Record<FeeTierOption, number> => ({
  [Tier.Fast]: tiers[Tier.Fast].feeAmount,
  [Tier.Medium]: tiers[Tier.Medium].feeAmount,
  [Tier.Slow]: tiers[Tier.Slow].feeAmount,
})
