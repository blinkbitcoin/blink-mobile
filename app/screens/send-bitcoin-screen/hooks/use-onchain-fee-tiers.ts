import { useCallback, useEffect, useState } from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { extractOnchainFees, prepareSend } from "@app/self-custodial/bridge"

export const FeeTierOption = {
  Fast: "fast",
  Medium: "medium",
  Slow: "slow",
} as const

export type FeeTierOption = (typeof FeeTierOption)[keyof typeof FeeTierOption]

export type FeeTierInfo = {
  feeSats: number
  etaMinutes: number
}

export const ETA_MINUTES: Record<FeeTierOption, number> = {
  [FeeTierOption.Fast]: 10,
  [FeeTierOption.Medium]: 30,
  [FeeTierOption.Slow]: 60,
}

const DEFAULT_TIERS: Record<FeeTierOption, FeeTierInfo> = {
  [FeeTierOption.Fast]: { feeSats: 0, etaMinutes: ETA_MINUTES[FeeTierOption.Fast] },
  [FeeTierOption.Medium]: { feeSats: 0, etaMinutes: ETA_MINUTES[FeeTierOption.Medium] },
  [FeeTierOption.Slow]: { feeSats: 0, etaMinutes: ETA_MINUTES[FeeTierOption.Slow] },
}

export const useOnchainFeeTiers = (
  sdk: BreezSdkInterface | null,
  address: string | undefined,
  amountSats: number | undefined,
): Record<FeeTierOption, FeeTierInfo> => {
  const [tiers, setTiers] = useState(DEFAULT_TIERS)

  const fetchFees = useCallback(async () => {
    if (!sdk || !address || !amountSats) return

    try {
      const prepared = await prepareSend(sdk, address, BigInt(amountSats))
      const fees = extractOnchainFees(prepared)
      if (!fees) return

      setTiers({
        [FeeTierOption.Fast]: {
          feeSats: fees.fast,
          etaMinutes: ETA_MINUTES[FeeTierOption.Fast],
        },
        [FeeTierOption.Medium]: {
          feeSats: fees.medium,
          etaMinutes: ETA_MINUTES[FeeTierOption.Medium],
        },
        [FeeTierOption.Slow]: {
          feeSats: fees.slow,
          etaMinutes: ETA_MINUTES[FeeTierOption.Slow],
        },
      })
    } catch {
      // keep defaults
    }
  }, [sdk, address, amountSats])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  return tiers
}
