import { useCallback, useEffect, useState } from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { getRecommendedFees } from "@app/self-custodial/bridge"

import {
  ETA_MINUTES,
  type FeeTierInfo,
  type FeeTierOption,
  FeeTierOption as Tier,
} from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"

const DEFAULT_TIERS: Record<FeeTierOption, FeeTierInfo> = {
  [Tier.Fast]: { feeSats: 0, etaMinutes: ETA_MINUTES[Tier.Fast] },
  [Tier.Medium]: { feeSats: 0, etaMinutes: ETA_MINUTES[Tier.Medium] },
  [Tier.Slow]: { feeSats: 0, etaMinutes: ETA_MINUTES[Tier.Slow] },
}

export const useRecommendedFeeTiers = (
  sdk: BreezSdkInterface | null,
  enabled: boolean,
): Record<FeeTierOption, FeeTierInfo> => {
  const [tiers, setTiers] = useState(DEFAULT_TIERS)

  const fetchFees = useCallback(async () => {
    if (!sdk || !enabled) return

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
    } catch {
      // keep defaults
    }
  }, [sdk, enabled])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  return tiers
}

export const getFeeRateSatPerVb = (
  tiers: Record<FeeTierOption, FeeTierInfo>,
): Record<FeeTierOption, number> => ({
  [Tier.Fast]: tiers[Tier.Fast].feeSats,
  [Tier.Medium]: tiers[Tier.Medium].feeSats,
  [Tier.Slow]: tiers[Tier.Slow].feeSats,
})
