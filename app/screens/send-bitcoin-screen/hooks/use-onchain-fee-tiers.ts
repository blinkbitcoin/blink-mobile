import { useCallback, useEffect, useState } from "react"

import {
  SdkError,
  SdkError_Tags as SdkErrorTags,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { extractOnchainFees, prepareSend } from "@app/self-custodial/bridge"

import { FeeTierOption, type FeeTierInfo } from "./fee-tiers.types"

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

export const SdkFeeError = {
  InsufficientFunds: "insufficient_funds",
  InvalidInput: "invalid_input",
  NetworkError: "network_error",
  Generic: "generic",
} as const

export type SdkFeeError = (typeof SdkFeeError)[keyof typeof SdkFeeError]

type OnchainFeeTiersResult = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  error: SdkFeeError | null
}

const SDK_ERROR_TAG_MAP: Partial<Record<SdkErrorTags, SdkFeeError>> = {
  [SdkErrorTags.InsufficientFunds]: SdkFeeError.InsufficientFunds,
  [SdkErrorTags.InvalidInput]: SdkFeeError.InvalidInput,
  [SdkErrorTags.NetworkError]: SdkFeeError.NetworkError,
}

const MESSAGE_TAG_MATCHERS: Array<[SdkErrorTags, SdkFeeError]> = [
  [SdkErrorTags.InsufficientFunds, SdkFeeError.InsufficientFunds],
  [SdkErrorTags.InvalidInput, SdkFeeError.InvalidInput],
  [SdkErrorTags.NetworkError, SdkFeeError.NetworkError],
]

const classifyError = (err: unknown): SdkFeeError => {
  if (SdkError.instanceOf(err)) {
    return SDK_ERROR_TAG_MAP[err.tag] ?? SdkFeeError.Generic
  }
  const message = err instanceof Error ? err.message : String(err)
  for (const [tag, code] of MESSAGE_TAG_MATCHERS) {
    if (message.includes(tag)) return code
  }
  return SdkFeeError.Generic
}

export const useOnchainFeeTiers = (
  sdk: BreezSdkInterface | null,
  address: string | undefined,
  amountSats: number | undefined,
): OnchainFeeTiersResult => {
  const [tiers, setTiers] = useState(DEFAULT_TIERS)
  const [error, setError] = useState<SdkFeeError | null>(null)

  const fetchFees = useCallback(async () => {
    if (!sdk || !address || !amountSats) {
      setError(null)
      return
    }

    try {
      const prepared = await prepareSend(sdk, {
        paymentRequest: address,
        amount: BigInt(amountSats),
      })
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
      setError(null)
    } catch (err) {
      setError(classifyError(err))
    }
  }, [sdk, address, amountSats])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  return { tiers, error }
}
