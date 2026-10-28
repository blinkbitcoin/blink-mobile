// Brand spacing and radius tokens.
// Compose larger gaps by doubling (60 = 2 * xxxl, 90 = 3 * xxxl).
// Prefer these over inline numeric literals in new code.

export const spacing = {
  xs: 3,
  sm: 5,
  md: 8,
  lg: 10,
  xl: 14,
  xxl: 20,
  xxxl: 30,
} as const

export const radius = {
  sm: 8,
  lg: 16,
  full: 999,
} as const
