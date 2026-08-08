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
  /** The server has this account locked mid-migration, but the device holds neither a
   *  resumable checkpoint nor a reusable pending wallet (e.g. after a reinstall), so a
   *  restart would only provision another orphan; support is the only way forward. */
  LockedWithoutCheckpoint: "locked-without-checkpoint",
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
 * Reasons worth telling the user to restart the app for, rather than leading with support.
 * The start latch is in-memory only, so a relaunch sends a fresh `migrationStart`: a refusal
 * that was transient (a state conflict, a dollar balance the gate now asks them to empty)
 * clears itself, and the user starts the migration again from the intro. Nothing resumes on
 * its own — the gate's resume path needs a server-side lock, which a refused start never
 * armed.
 *
 * Only a SUBSET of `start-refused` is actually restart-resolvable: the backend maps its
 * permanent rejections (a cohort exclusion) onto the same MIGRATION_STATE_CONFLICT code as a
 * transient conflict, so the client cannot tell them apart. Those users spend one restart
 * before the copy's "still seeing this screen?" line sends them to support, which is the
 * accepted trade-off for deflecting the transient majority. A distinct backend code for
 * permanent refusals would let them keep the support-first copy.
 *
 * Lives next to the taxonomy so adding a reason above is decided in the same place.
 */
export const RESTART_RESOLVABLE_REASONS: ReadonlySet<MigrationSupportReason> = new Set([
  MigrationSupportReason.StartRefused,
])

/**
 * Where the support screen was opened from, which decides its Back target. The commit flow
 * has the commit point (Step 8) underneath, so Back returns there, skipping the
 * back-swallowing transfer screen. The resume handover is pushed from the root navigator
 * with no migration screens beneath it, so Back dismisses to where it came from rather than
 * fabricating a fresh commit screen over an already-completed migration. The gate handover
 * has nothing behind it at all — the gate underneath would only replay the handover — so
 * support becomes the terminal screen with no Back.
 */
export const MigrationSupportOrigin = {
  Commit: "commit",
  Resume: "resume",
  Gate: "gate",
} as const

export type MigrationSupportOrigin =
  (typeof MigrationSupportOrigin)[keyof typeof MigrationSupportOrigin]
