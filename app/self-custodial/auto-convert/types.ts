export const ReceiveAssetMode = {
  Bitcoin: "bitcoin",
  Dollar: "dollar",
} as const

export type ReceiveAssetMode = (typeof ReceiveAssetMode)[keyof typeof ReceiveAssetMode]

export const ReceiveRail = {
  Lightning: "lightning",
  Onchain: "onchain",
} as const

export type ReceiveRail = (typeof ReceiveRail)[keyof typeof ReceiveRail]

/**
 * Pending auto-convert, keyed by the full Bolt11 invoice. `attempts`
 * and `lastAttemptAtMs` drive the retry-with-cooldown policy.
 */
export type PendingAutoConvert = {
  paymentRequest: string
  amountSats: number | undefined
  createdAtMs: number
  attempts: number
  lastAttemptAtMs: number | undefined
}

export const AutoConvertStatus = {
  Converted: "converted",
  AlreadyConverted: "already-converted",
  SkippedBelowMin: "skipped-below-min",
  SkippedStableBalanceActive: "skipped-stable-balance-active",
  /** Nothing went out: it waits behind an earlier conversion that may have been lost, so
   *  the wait is no attempt of its own, and is tried again once the wait is over. */
  Deferred: "deferred",
  Failed: "failed",
} as const

export type AutoConvertStatus = (typeof AutoConvertStatus)[keyof typeof AutoConvertStatus]

export type AutoConvertOutcome =
  /** With the conversion's own payment when the bridge names it, for the pairing. */
  | { status: typeof AutoConvertStatus.Converted; conversionPaymentId?: string }
  | { status: typeof AutoConvertStatus.AlreadyConverted }
  | { status: typeof AutoConvertStatus.SkippedBelowMin }
  | { status: typeof AutoConvertStatus.SkippedStableBalanceActive }
  /** With how long, at most, until it can go out: none when it waits for the user, which
   *  no time ends. */
  | { status: typeof AutoConvertStatus.Deferred; retryAfterMs?: number }
  | { status: typeof AutoConvertStatus.Failed }

/** Links a receive paymentId to the conversion paymentId performed for it. */
export type AutoConvertPairing = {
  receivePaymentId: string
  conversionPaymentId: string
  pairedAtMs: number
}
