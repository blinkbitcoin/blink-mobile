import {
  SdkError,
  SdkError_Tags as SdkErrorTags,
} from "@breeztech/breez-sdk-spark-react-native"

export const SelfCustodialErrorCode = {
  InsufficientFunds: "sc_insufficient_funds",
  BelowMinimum: "sc_below_minimum",
  NetworkError: "sc_network_error",
  InvalidInput: "sc_invalid_input",
  Generic: "sc_generic",
} as const

export type SelfCustodialErrorCode =
  (typeof SelfCustodialErrorCode)[keyof typeof SelfCustodialErrorCode]

const TAG_TO_CODE: Record<SdkErrorTags, SelfCustodialErrorCode> = {
  [SdkErrorTags.InsufficientFunds]: SelfCustodialErrorCode.InsufficientFunds,
  [SdkErrorTags.MaxDepositClaimFeeExceeded]: SelfCustodialErrorCode.InsufficientFunds,
  [SdkErrorTags.NetworkError]: SelfCustodialErrorCode.NetworkError,
  [SdkErrorTags.ChainServiceError]: SelfCustodialErrorCode.NetworkError,
  [SdkErrorTags.InvalidInput]: SelfCustodialErrorCode.InvalidInput,
  [SdkErrorTags.InvalidUuid]: SelfCustodialErrorCode.InvalidInput,
  [SdkErrorTags.LnurlError]: SelfCustodialErrorCode.InvalidInput,
  [SdkErrorTags.MissingUtxo]: SelfCustodialErrorCode.InvalidInput,
  [SdkErrorTags.StorageError]: SelfCustodialErrorCode.Generic,
  [SdkErrorTags.Signer]: SelfCustodialErrorCode.Generic,
  [SdkErrorTags.SparkError]: SelfCustodialErrorCode.Generic,
  [SdkErrorTags.Generic]: SelfCustodialErrorCode.Generic,
}

const INNER_REFINEMENT_TAGS: ReadonlySet<SdkErrorTags> = new Set([
  SdkErrorTags.SparkError,
  SdkErrorTags.Generic,
  SdkErrorTags.InvalidInput,
  SdkErrorTags.InsufficientFunds,
])

const INNER_HINTS: Array<[string, SelfCustodialErrorCode]> = [
  ["minimum", SelfCustodialErrorCode.BelowMinimum],
  ["insufficient", SelfCustodialErrorCode.InsufficientFunds],
  ["timeout", SelfCustodialErrorCode.NetworkError],
  ["network", SelfCustodialErrorCode.NetworkError],
]

const readStringInner = (err: unknown): string | undefined => {
  if (typeof err !== "object" || err === null || !("inner" in err)) return undefined
  const inner = (err as { inner: unknown }).inner
  if (Array.isArray(inner) && typeof inner[0] === "string") return inner[0]
  return undefined
}

export const classifySdkError = (err: unknown): SelfCustodialErrorCode => {
  if (!SdkError.instanceOf(err)) return SelfCustodialErrorCode.Generic
  if (INNER_REFINEMENT_TAGS.has(err.tag)) {
    const inner = readStringInner(err)?.toLowerCase()
    if (inner) {
      for (const [hint, code] of INNER_HINTS) {
        if (inner.includes(hint)) return code
      }
    }
  }
  return TAG_TO_CODE[err.tag]
}
