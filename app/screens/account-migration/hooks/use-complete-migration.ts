import { useCallback } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { reportError } from "@app/utils/error-logging"

import { useCustodialOwnerId } from "./use-custodial-owner-id"
import { useDiscardCustodialSession } from "./use-discard-custodial-session"
import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"
import { usePendingMigrationAccounts } from "./use-pending-migration-accounts"
import { useSeedMigratedAccountSettings } from "./use-seed-migrated-account-settings"

/** Discards the migrated custodial session so it no longer appears on the device, then switches
 *  the active session to the provisioned self-custodial account and clears the checkpoint plus
 *  the pending-wallet record, so the new account starts showing in the switcher. The fallible
 *  step goes first: if the discard fails, the user is still on the working custodial session
 *  with the checkpoint intact, never stranded on an empty self-custodial account. Also
 *  surfaces the migration's checkpoint and account id from a single source of truth. */
export const useCompleteMigration = () => {
  const { checkpoint, accountId, expectedReceiveSats, loading, clearCheckpoint } =
    useMigrationCheckpointState()
  const { clearPendingAccount } = usePendingMigrationAccounts()
  const { setActiveAccountId, accounts, loading: accountsLoading } = useAccountRegistry()
  const { ownerId: custodialOwnerId } = useCustodialOwnerId()
  const { discardCustodialSession } = useDiscardCustodialSession()
  const { seedMigratedSettings } = useSeedMigratedAccountSettings()

  /** The cleanup is awaited before returning so the caller navigates only once the record
   *  is gone: otherwise a crash before the write landed would keep the stale record
   *  forever and hide the now-funded wallet from the switcher. */
  const completeMigration = useCallback(async (): Promise<boolean> => {
    if (!accountId) return false
    /** The provisioned account must still exist before discarding the working custodial
     *  session: a keychain loss in the resume window would otherwise switch to an account
     *  that is gone, stranding the user with neither. A false result routes to support. */
    const accountExists = accounts.some((account) => account.id === accountId)
    if (!accountExists) return false
    /** Copy the custodial display currency / language / theme onto the migrated account
     *  while its session is still live — the discard below is what makes the server
     *  values unreachable. Placed after the existence check so a migration that is about
     *  to be refused writes nothing, and on this path rather than at provision time so
     *  resumed runs (which never mount the migration screens) are covered too (#4099).
     *  Reported but never rethrown: losing a currency preference must not strand a user
     *  mid-migration, and the account keeps today's defaults if the copy fails. */
    try {
      await seedMigratedSettings(accountId)
    } catch (err) {
      reportError("Migration settings carry-over", err)
    }
    await discardCustodialSession()
    setActiveAccountId(accountId)
    await clearCheckpoint()
    if (custodialOwnerId) await clearPendingAccount(custodialOwnerId)
    return true
  }, [
    accountId,
    accounts,
    custodialOwnerId,
    setActiveAccountId,
    seedMigratedSettings,
    discardCustodialSession,
    clearCheckpoint,
    clearPendingAccount,
  ])

  /** The account check completeMigration makes is only trustworthy once both the checkpoint
   *  and the registry have hydrated: on a resume launch the registry's accounts start empty
   *  and fill after an async keystore read, so a swap decided before then would read the
   *  present destination as missing and hand a healthy user to support. */
  const isMigrationDataLoading = loading || accountsLoading

  return {
    migrationCheckpoint: checkpoint,
    migrationAccountId: accountId,
    /** What the receive gate waits for; null on checkpoints saved before the field existed. */
    migrationExpectedReceiveSats: expectedReceiveSats,
    migrationLoading: isMigrationDataLoading,
    completeMigration,
  }
}
