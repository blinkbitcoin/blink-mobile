export const AccountTypeMode = {
  Create: "create",
  Restore: "restore",
} as const

export type AccountTypeMode = (typeof AccountTypeMode)[keyof typeof AccountTypeMode]
