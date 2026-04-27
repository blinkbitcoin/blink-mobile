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
