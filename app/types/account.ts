export const AccountTypeMode = {
  Create: "create",
  Restore: "restore",
} as const

export type AccountTypeMode = (typeof AccountTypeMode)[keyof typeof AccountTypeMode]

/**
 * The self-custodial region posture: Enhanced consents to a connection check for
 * region-permitted features; Anon runs no check, Bitcoin only. Absent = not yet chosen,
 * and absent persists on fully onboarded accounts: restore activates the account before
 * showing the mode screen and has no resume back onto it, so a kill there leaves no entry
 * and nothing asks again. Consumers must handle an unset mode rather than assume
 * onboarding recorded one.
 */
export const AccountMode = {
  Enhanced: "enhanced",
  Anon: "anon",
} as const

export type AccountMode = (typeof AccountMode)[keyof typeof AccountMode]
