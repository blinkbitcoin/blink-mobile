import { useCallback, useEffect, useRef, useState } from "react"

import {
  SdkError,
  SdkError_Tags as SdkErrorTags,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { extractOnchainFees, prepareSend } from "@app/self-custodial/bridge"
import { FEE_TIER_ETA_MINUTES } from "@app/types/payment"

import {
  buildZeroTiers,
  FeeTierOption,
  FeeUnit,
  type FeeTierInfo,
} from "./fee-tiers.types"
import { useQuoteStatus } from "./use-quote-status"

export const ETA_MINUTES: Record<FeeTierOption, number> = FEE_TIER_ETA_MINUTES

const DEFAULT_TIERS = buildZeroTiers(ETA_MINUTES, FeeUnit.Sats)

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
  hasQuote: boolean
}

const SDK_ERROR_TAG_MAP: Partial<Record<SdkErrorTags, SdkFeeError>> = {
  [SdkErrorTags.InsufficientFunds]: SdkFeeError.InsufficientFunds,
  [SdkErrorTags.InvalidInput]: SdkFeeError.InvalidInput,
  [SdkErrorTags.NetworkError]: SdkFeeError.NetworkError,
}

export const classifySdkFeeError = (err: unknown): SdkFeeError => {
  if (SdkError.instanceOf(err)) {
    return SDK_ERROR_TAG_MAP[err.tag] ?? SdkFeeError.Generic
  }
  return SdkFeeError.Generic
}

export const useOnchainFeeTiers = (
  sdk: BreezSdkInterface | null,
  address: string | undefined,
  amountSats: number | undefined,
): OnchainFeeTiersResult => {
  const [tiers, setTiers] = useState(DEFAULT_TIERS)
  /** Holds only the reason; whether it still applies is decided by the keyed failure flag. */
  const [failureReason, setFailureReason] = useState<SdkFeeError | null>(null)
  /** The SDK instance cannot be keyed by value, so its absence gates the quote instead. */
  const inputsKey = sdk && address && amountSats ? `${address}|${amountSats}` : null
  const { hasQuote, hasFailed, discardQuote, markQuoted, markFailed } =
    useQuoteStatus(inputsKey)
  // Discards stale prepareSend resolutions when deps change mid-flight.
  const requestTokenRef = useRef(0)

  const error = hasFailed ? failureReason : null

  const fetchFees = useCallback(async () => {
    requestTokenRef.current += 1
    const token = requestTokenRef.current
    /**
     * Whatever was quoted stops applying the moment this runs, request or gate alike. The
     * tiers go with it, so neither failure path below can leave the previous amount's fees
     * on hand: only the success path puts numbers back, which is what the custodial rail
     * already does and what keeps a caller reading tiers directly from reading stale ones.
     */
    discardQuote()
    setTiers(DEFAULT_TIERS)

    if (!sdk || !address || !amountSats) return

    try {
      const prepared = await prepareSend(sdk, {
        paymentRequest: address,
        amount: BigInt(amountSats),
      })
      if (token !== requestTokenRef.current) return

      const fees = extractOnchainFees(prepared)
      if (!fees) {
        setFailureReason(SdkFeeError.Generic)
        markFailed()
        return
      }

      setTiers({
        [FeeTierOption.Fast]: {
          feeAmount: fees.fast,
          feeUnit: FeeUnit.Sats,
          etaMinutes: ETA_MINUTES[FeeTierOption.Fast],
        },
        [FeeTierOption.Medium]: {
          feeAmount: fees.medium,
          feeUnit: FeeUnit.Sats,
          etaMinutes: ETA_MINUTES[FeeTierOption.Medium],
        },
        [FeeTierOption.Slow]: {
          feeAmount: fees.slow,
          feeUnit: FeeUnit.Sats,
          etaMinutes: ETA_MINUTES[FeeTierOption.Slow],
        },
      })
      markQuoted()
    } catch (err) {
      if (token !== requestTokenRef.current) return
      setFailureReason(classifySdkFeeError(err))
      markFailed()
    }
  }, [sdk, address, amountSats, discardQuote, markQuoted, markFailed])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  return { tiers, error, hasQuote }
}
