import { useCallback, useRef, useState } from "react"

import {
  SdkError,
  SdkError_Tags as SdkErrorTags,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { extractOnchainFees, prepareSend } from "@app/self-custodial/bridge"
import { FEE_TIER_ETA_MINUTES } from "@app/types/payment"
import { reportError } from "@app/utils/error-logging"

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

type OnchainFeeTiers = Record<FeeTierOption, FeeTierInfo>

type OnchainFeeTiersResult = {
  tiers: OnchainFeeTiers
  error: SdkFeeError | null
  hasQuote: boolean
  isQuoting: boolean
  /** Quotes the inputs on screen once. Resolves to the tiers, or null when it failed or
   *  the inputs moved on before it answered. */
  quote: () => Promise<OnchainFeeTiers | null>
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

/** Causes the sender fixes by changing the amount; anything else is worth a look. */
const EXPECTED_FEE_ERRORS: ReadonlySet<SdkFeeError> = new Set([
  SdkFeeError.InsufficientFunds,
  SdkFeeError.InvalidInput,
])

const toTiers = (fees: {
  fast: number
  medium: number
  slow: number
}): OnchainFeeTiers => ({
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

/**
 * Quotes on request only, never as the inputs change. The SDK's quote reserves the
 * wallet's leaves for the exact amount and may swap them with the operator first, so
 * quoting per keystroke ran several of those at once, each holding leaves another one
 * needed, and failed with an unclassified error on balances that could pay.
 */
export const useOnchainFeeTiers = (
  sdk: BreezSdkInterface | null,
  address: string | undefined,
  amountSats: number | undefined,
): OnchainFeeTiersResult => {
  const [quotedTiers, setQuotedTiers] = useState(DEFAULT_TIERS)
  /** Holds only the reason; whether it still applies is decided by the keyed failure flag. */
  const [failureReason, setFailureReason] = useState<SdkFeeError | null>(null)
  const [quotingKey, setQuotingKey] = useState<string | null>(null)
  /** The SDK instance cannot be keyed by value, so its absence gates the quote instead. */
  const inputsKey = sdk && address && amountSats ? `${address}|${amountSats}` : null
  const { hasQuote, hasFailed, markQuoted, markFailed } = useQuoteStatus(inputsKey)
  /** One quote at a time: a second press for the same inputs waits on the first. */
  const inFlightRef = useRef<{
    key: string
    promise: Promise<OnchainFeeTiers | null>
  } | null>(null)

  /** The inputs on screen now, so an answer for an amount since retyped is dropped. */
  const latestKeyRef = useRef(inputsKey)
  latestKeyRef.current = inputsKey

  const error = hasFailed ? failureReason : null
  const isQuoting = inputsKey !== null && quotingKey === inputsKey

  const quote = useCallback((): Promise<OnchainFeeTiers | null> => {
    if (!sdk || !address || !amountSats || !inputsKey) return Promise.resolve(null)
    if (inFlightRef.current?.key === inputsKey) return inFlightRef.current.promise

    const isStale = () => latestKeyRef.current !== inputsKey

    const run = async (): Promise<OnchainFeeTiers | null> => {
      setQuotingKey(inputsKey)
      try {
        const prepared = await prepareSend(sdk, {
          paymentRequest: address,
          amount: BigInt(amountSats),
        })
        if (isStale()) return null

        const fees = extractOnchainFees(prepared)
        if (!fees) {
          reportError(
            "Self-custodial onchain fee quote",
            new Error("prepareSend returned no BitcoinAddress fee quote"),
          )
          setFailureReason(SdkFeeError.Generic)
          markFailed()
          return null
        }

        const tiers = toTiers(fees)
        setQuotedTiers(tiers)
        markQuoted()
        return tiers
      } catch (err) {
        const reason = classifySdkFeeError(err)
        reportError("Self-custodial onchain fee quote", err, {
          expected: EXPECTED_FEE_ERRORS.has(reason),
        })
        if (isStale()) return null

        setFailureReason(reason)
        markFailed()
        return null
      } finally {
        // A quote for newer inputs may already be out; only this one's marks are cleared.
        if (inFlightRef.current?.key === inputsKey) inFlightRef.current = null
        setQuotingKey((key) => (key === inputsKey ? null : key))
      }
    }

    const promise = run()
    inFlightRef.current = { key: inputsKey, promise }
    return promise
  }, [sdk, address, amountSats, inputsKey, markQuoted, markFailed])

  /** Tiers quoted for other inputs are not this payment's, so they read as unquoted. */
  const tiers = hasQuote ? quotedTiers : DEFAULT_TIERS

  return { tiers, error, hasQuote, isQuoting, quote }
}
