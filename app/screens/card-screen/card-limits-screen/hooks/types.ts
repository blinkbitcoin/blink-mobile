export const LimitField = {
  Daily: "daily",
  Monthly: "monthly",
} as const

export type LimitField = (typeof LimitField)[keyof typeof LimitField]
