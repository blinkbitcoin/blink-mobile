import { useCallback, useEffect, useState } from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { getRecommendedFees } from "@app/self-custodial/bridge"

import {
  classifySdkFeeError,
  ETA_MINUTES,
  SdkFeeError,
} from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"
import {
  type FeeTierInfo,
  FeeTierOption,
  FeeTierOption as Tier,
} from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"

const DEFAULT_TIERS: Record<FeeTierOption, FeeTierInfo> = {
  [Tier.Fast]: { feeSats: 0, etaMinutes: ETA_MINUTES[Tier.Fast] },
  [Tier.Medium]: { feeSats: 0, etaMinutes: ETA_MINUTES[Tier.Medium] },
  [Tier.Slow]: { feeSats: 0, etaMinutes: ETA_MINUTES[Tier.Slow] },
}

type RecommendedFeeTiersResult = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  error: SdkFeeError | null
}

export const useRecommendedFeeTiers = (
  sdk: BreezSdkInterface | null,
  enabled: boolean,
): RecommendedFeeTiersResult => {
  const [tiers, setTiers] = useState(DEFAULT_TIERS)
  const [error, setError] = useState<SdkFeeError | null>(null)

  const fetchFees = useCallback(async () => {
    if (!sdk || !enabled) {
      setError(null)
      return
    }

    try {
      const rates = await getRecommendedFees(sdk)
      setTiers({
        [Tier.Fast]: {
          feeSats: rates.fastest,
          etaMinutes: ETA_MINUTES[Tier.Fast],
        },
        [Tier.Medium]: {
          feeSats: rates.halfHour,
          etaMinutes: ETA_MINUTES[Tier.Medium],
        },
        [Tier.Slow]: {
          feeSats: rates.economy,
          etaMinutes: ETA_MINUTES[Tier.Slow],
        },
      })
      setError(null)
    } catch (err) {
      setError(classifySdkFeeError(err))
    }
  }, [sdk, enabled])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  return { tiers, error }
}

export const getFeeRateSatPerVb = (
  tiers: Record<FeeTierOption, FeeTierInfo>,
): Record<FeeTierOption, number> => ({
  [Tier.Fast]: tiers[Tier.Fast].feeSats,
  [Tier.Medium]: tiers[Tier.Medium].feeSats,
  [Tier.Slow]: tiers[Tier.Slow].feeSats,
})
