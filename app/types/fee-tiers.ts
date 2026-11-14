export const FeeTierOption = {
  Fast: "fast",
  Medium: "medium",
  Slow: "slow",
} as const

export type FeeTierOption = (typeof FeeTierOption)[keyof typeof FeeTierOption]

/**
 * What a tier's number actually measures. Carried alongside the number so a consumer reads
 * the unit off the tier instead of re-deriving it, which is how a cents fee ends up
 * rendered as sats.
 */
export const FeeUnit = {
  Sats: "sats",
  Cents: "cents",
  /** A fee *rate*, not an absolute fee: only the unclaimed-deposits refund flow uses it. */
  SatPerVbyte: "sat_per_vbyte",
} as const

export type FeeUnit = (typeof FeeUnit)[keyof typeof FeeUnit]

export type FeeTierInfo = {
  feeAmount: number
  feeUnit: FeeUnit
  etaMinutes: number
}

/**
 * The placeholder every tier hook starts from, and returns to when it has nothing to
 * quote. Built once per caller so the identity stays stable: handing back a fresh object
 * on each reset would re-render the selector for no change.
 */
export const buildZeroTiers = (
  etaMinutes: Record<FeeTierOption, number>,
  feeUnit: FeeUnit,
): Record<FeeTierOption, FeeTierInfo> => ({
  [FeeTierOption.Fast]: {
    feeAmount: 0,
    feeUnit,
    etaMinutes: etaMinutes[FeeTierOption.Fast],
  },
  [FeeTierOption.Medium]: {
    feeAmount: 0,
    feeUnit,
    etaMinutes: etaMinutes[FeeTierOption.Medium],
  },
  [FeeTierOption.Slow]: {
    feeAmount: 0,
    feeUnit,
    etaMinutes: etaMinutes[FeeTierOption.Slow],
  },
})
