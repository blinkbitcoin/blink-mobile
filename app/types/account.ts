export const AccountTypeMode = {
  Create: "create",
  Restore: "restore",
} as const

export type AccountTypeMode = (typeof AccountTypeMode)[keyof typeof AccountTypeMode]

/**
 * The self-custodial region posture: Enhanced consents to a connection check for
 * region-permitted features; Anon runs no check, Bitcoin only. Absent = not yet chosen.
 */
export const AccountMode = {
  Enhanced: "enhanced",
  Anon: "anon",
} as const

export type AccountMode = (typeof AccountMode)[keyof typeof AccountMode]
