import { useCallback } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { MigrationCompletion } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"

import {
  AccountCloseOutcome,
  useCloseCustodialAccount,
} from "./use-close-custodial-account"
import { useCustodialOwnerId } from "./use-custodial-owner-id"
import { useDiscardCustodialSession } from "./use-discard-custodial-session"
import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"
import { usePendingMigrationAccounts } from "./use-pending-migration-accounts"
import { useSeedMigratedAccountSettings } from "./use-seed-migrated-account-settings"

/** Module-level, because the callers are separate hook instances with no view of each
 *  other's refs: the resume hook stays mounted in the tab navigator underneath the pushed
 *  migration stack, so it and the transfer screen can both decide to finish at the same
 *  moment, and two runs mean two account deletions and two competing navigation resets. */
let isCompletionInFlight = false

/** Repeated inside the Error because `reportError` forwards only the message. */
const OWNER_MISMATCH_REPORT = "Migration completion owner mismatch"

/** Closes the emptied custodial account, discards its session, then switches to the
 *  provisioned self-custodial account and clears the checkpoint plus the pending-wallet
 *  record. The order is forced, not preferred: the close authenticates with the custodial
 *  token that the discard destroys, so it is the one step no later launch can retry. */
export const useCompleteMigration = () => {
  const {
    checkpoint,
    accountId,
    expectedReceiveSats,
    checkpointOwnerId,
    loading,
    clearCheckpoint,
  } = useMigrationCheckpointState()
  const { clearPendingAccount } = usePendingMigrationAccounts()
  const { setActiveAccountId, accounts, loading: accountsLoading } = useAccountRegistry()
  const { ownerId: custodialOwnerId } = useCustodialOwnerId()
  const { closeCustodialAccount } = useCloseCustodialAccount()
  const { discardCustodialSession } = useDiscardCustodialSession()
  const { seedMigratedSettings } = useSeedMigratedAccountSettings()

  const completeMigration = useCallback(async (): Promise<MigrationCompletion> => {
    if (!accountId) return MigrationCompletion.AccountMissing
    /** A keychain loss in the resume window would otherwise switch to an account that is
     *  gone, stranding the user with neither. */
    const accountExists = accounts.some((account) => account.id === accountId)
    if (!accountExists) return MigrationCompletion.AccountMissing

    /** The close deletes whatever account the active token authenticates, so it may only run
     *  once this session is proven to be the one that saved the checkpoint. An owner-less
     *  record is claimed by whoever is active, which would aim the deletion at a stranger. */
    const isOwnedByActiveSession =
      Boolean(custodialOwnerId) && checkpointOwnerId === custodialOwnerId
    if (!isOwnedByActiveSession) {
      reportError(
        OWNER_MISMATCH_REPORT,
        new Error(
          `${OWNER_MISMATCH_REPORT}: checkpoint ${checkpointOwnerId ?? "unknown"}, session ${
            custodialOwnerId ?? "unknown"
          }`,
        ),
      )
      return MigrationCompletion.CloseUnavailable
    }

    if (isCompletionInFlight) return MigrationCompletion.CloseUnavailable
    isCompletionInFlight = true

    try {
      /** Copy the custodial display currency / language / theme onto the migrated account
       *  while its session is still live — the close and the discard below are what make
       *  the server values unreachable, so this runs before both. Placed after the refusal
       *  checks so a migration that is about to be refused writes nothing, and on this path
       *  rather than at provision time so resumed runs (which never mount the migration
       *  screens) are covered too (#4099). Reported but never rethrown: losing a currency
       *  preference must not strand a user mid-migration, and the account keeps today's
       *  defaults if the copy fails. */
      try {
        await seedMigratedSettings(accountId)
      } catch (err) {
        reportError("Migration settings carry-over", err)
      }

      /** Nothing settled, so nothing is spent: leave the session and the checkpoint exactly
       *  as they are and let the caller offer another attempt. */
      const closeOutcome = await closeCustodialAccount(custodialOwnerId)
      if (closeOutcome === AccountCloseOutcome.Retryable)
        return MigrationCompletion.CloseUnavailable

      const isAccountClosed = closeOutcome === AccountCloseOutcome.Closed
      await discardCustodialSession({ isSessionAlive: !isAccountClosed })
      setActiveAccountId(accountId)
      await clearCheckpoint()
      if (custodialOwnerId) await clearPendingAccount(custodialOwnerId)

      /** A refused close still finishes the migration: the funds are already self-custodial,
       *  and holding the user on a dead custodial session would cost them their wallet over
       *  an account only support can now remove. */
      return isAccountClosed
        ? MigrationCompletion.Completed
        : MigrationCompletion.CloseRefused
    } finally {
      // eslint-disable-next-line require-atomic-updates -- releasing after the await is the point
      isCompletionInFlight = false
    }
  }, [
    accountId,
    accounts,
    custodialOwnerId,
    checkpointOwnerId,
    setActiveAccountId,
    seedMigratedSettings,
    closeCustodialAccount,
    discardCustodialSession,
    clearCheckpoint,
    clearPendingAccount,
  ])

  /** The account check is only trustworthy once both the checkpoint and the registry have
   *  hydrated: the registry's accounts start empty and fill after an async keystore read. */
  const isMigrationDataLoading = loading || accountsLoading

  return {
    migrationCheckpoint: checkpoint,
    migrationAccountId: accountId,
    /** What the receive gate waits for; null on checkpoints saved before the field existed. */
    migrationExpectedReceiveSats: expectedReceiveSats,
    /** Read before the discard clears it, so a handover raised after the swap can still name
     *  the custodial account support has to close. */
    custodialAccountId: custodialOwnerId,
    migrationLoading: isMigrationDataLoading,
    completeMigration,
  }
}
