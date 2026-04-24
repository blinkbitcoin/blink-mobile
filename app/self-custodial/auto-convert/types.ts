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
  Failed: "failed",
} as const

export type AutoConvertStatus = (typeof AutoConvertStatus)[keyof typeof AutoConvertStatus]

export type AutoConvertOutcome =
  | { status: typeof AutoConvertStatus.Converted }
  | { status: typeof AutoConvertStatus.AlreadyConverted }
  | { status: typeof AutoConvertStatus.SkippedBelowMin }
  | { status: typeof AutoConvertStatus.SkippedStableBalanceActive }
  | { status: typeof AutoConvertStatus.Failed }
