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

/** Product mode names, never localized. The stored value stays `anon`: the rename to
 *  Incognito is what the user reads, not what the account records. */
export const ACCOUNT_MODE_NAMES: Record<AccountMode, string> = {
  [AccountMode.Enhanced]: "Enhanced",
  [AccountMode.Anon]: "Incognito",
}

/**
 * Why account creation was refused, which decides what the unsupported-region screen
 * offers: a whole region closed to us leaves nothing, while only the first Blink account
 * being refused still leaves self-custodial on the table.
 */
export const CreationBlockReason = {
  Region: "region",
  FirstCustodialSignup: "firstCustodialSignup",
  /** The location never resolved, so compliance could not be checked either way. */
  UnknownRegion: "unknownRegion",
} as const

export type CreationBlockReason =
  (typeof CreationBlockReason)[keyof typeof CreationBlockReason]
