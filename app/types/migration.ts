/**
 * Shape of the backend migration preview (the authed top-level Query.migration.preview):
 * the server computes the network fee, whether Blink covers it, and the resulting amount.
 * The client renders these four fields verbatim and never does the arithmetic itself.
 */
export type AccountMigrationPreview = {
  balanceSats: number
  feeSats: number
  feeCoveredByBlink: boolean
  receiveSats: number
}

/**
 * Why the migration handed the user to support. Deliberately NOT translated: the value is
 * copied out of an email by a human, so it has to stay greppable whatever locale produced
 * the ticket, and only its label is localized.
 */
export const MigrationSupportReason = {
  /** The server answered but had no preview to give. */
  PreviewUnavailable: "preview-unavailable",
  /** The wallet query settled without balances, so the dollar row has nothing to show. */
  BalancesUnavailable: "balances-unavailable",
  /** The server refused to open the migration flow (cohort, dollars, state conflict). */
  StartRefused: "start-refused",
  /** The checkpoint reached the transfer with no provisioned self-custodial account. */
  SelfCustodialAccountMissing: "self-custodial-account-missing",
  /** The migration finished server-side, but the destination self-custodial account is no
   *  longer on this device (its key is gone, e.g. after a reinstall), so the resume swap
   *  cannot run and no retry brings it back. */
  SelfCustodialAccountNotOnDevice: "self-custodial-account-not-on-device",
  /** The transfer itself failed or threw. */
  TransferFailed: "transfer-failed",
  /** The lightning-address re-point onto the migrated account failed. */
  LnAddressTransferFailed: "ln-address-transfer-failed",
  /** The support screen was reached without a reason, e.g. after a navigation-state
   *  restore; a named fallback so the ticket is never blank and never a bare string. */
  Unknown: "unknown",
} as const

export type MigrationSupportReason =
  (typeof MigrationSupportReason)[keyof typeof MigrationSupportReason]

/**
 * Where the support screen was opened from, which decides its Back target. The commit flow
 * has the commit point (Step 8) underneath, so Back returns there, skipping the
 * back-swallowing transfer screen. The resume handover is pushed from the root navigator
 * with no migration screens beneath it, so Back dismisses to where it came from rather than
 * fabricating a fresh commit screen over an already-completed migration.
 */
export const MigrationSupportOrigin = {
  Commit: "commit",
  Resume: "resume",
} as const

export type MigrationSupportOrigin =
  (typeof MigrationSupportOrigin)[keyof typeof MigrationSupportOrigin]
