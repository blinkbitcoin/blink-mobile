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

/** The backend rejection codes the migration reads off a mutation payload: a server
 *  contract rather than one hook's detail, so a rename lands in a single place. */
export const MigrationRejectionCode = {
  /** Refused while a transfer is still draining. Transient by contract. */
  StateConflict: "MIGRATION_STATE_CONFLICT",
  /** The phone-deletion cap, carrying the server's own contact-support copy. */
  OperationRestricted: "OPERATION_RESTRICTED",
  /** A stale proof and a bad destination share this code; the clock skew tells them apart. */
  InvalidDestination: "MIGRATION_INVALID_DESTINATION",
} as const

export type MigrationRejectionCode =
  (typeof MigrationRejectionCode)[keyof typeof MigrationRejectionCode]

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
  /** The commit screen settled without the custodial owner id the lightning-address
   *  re-point signs its proof against (the session is no longer custodial, or the owner
   *  query answered with nothing). The re-point cannot fire at all without it, so it is a
   *  settled failure rather than a wait that resolves itself. */
  CustodialOwnerMissing: "custodial-owner-missing",
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
  /** The server paid the migration out, but the receive into the new self-custodial
   *  wallet stayed unconfirmed past the notice window — the funds look stuck in transit. */
  ReceiveDelayed: "receive-delayed",
  /** The lightning-address re-point onto the migrated account failed. */
  LnAddressTransferFailed: "ln-address-transfer-failed",
  /** The server refused to close the emptied custodial account for good (the phone-deletion
   *  cap). The migration itself finished; the account stays open until support removes it. */
  CustodialAccountCloseRefused: "custodial-account-close-refused",
  /** The funds landed, but finishing on this device threw: the session discard, the
   *  checkpoint clear or the pending-wallet write. Distinct from a transfer failure so
   *  support does not go looking for money that never moved. */
  CompletionFailed: "completion-failed",
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
  /** The only handover the transfer is expected to survive: the receive is still being
   *  watched underneath, so backing out returns to the screen watching it rather than
   *  popping to the commit screen, which would unmount the gate with it. */
  ReceiveDelayed: "receive-delayed",
  /** Raised by the commit path after it resets the stack with Home underneath, so Back
   *  returns there rather than fabricating a commit screen for a finished migration. */
  CloseRefused: "close-refused",
} as const

export type MigrationSupportOrigin =
  (typeof MigrationSupportOrigin)[keyof typeof MigrationSupportOrigin]

/**
 * How an attempt to finish a migration ended. Closing the emptied custodial account has
 * exactly one window: the session discard that follows destroys the only token that can
 * authenticate the deletion. So an unsettled close finishes nothing and keeps the session
 * and the checkpoint for a retry, while a settled refusal finishes everything and leaves
 * the account itself to support.
 */
export const MigrationCompletion = {
  Completed: "completed",
  /** No provisioned self-custodial account on this device, so there is nothing to swap to. */
  AccountMissing: "account-missing",
  CloseUnavailable: "close-unavailable",
  CloseRefused: "close-refused",
} as const

export type MigrationCompletion =
  (typeof MigrationCompletion)[keyof typeof MigrationCompletion]
