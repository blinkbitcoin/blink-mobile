import { useCallback } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"

import { useCustodialOwnerId } from "./use-custodial-owner-id"
import { useDiscardCustodialSession } from "./use-discard-custodial-session"
import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"
import { usePendingMigrationAccounts } from "./use-pending-migration-accounts"

/** Discards the migrated custodial session so it no longer appears on the device, then switches
 *  the active session to the provisioned self-custodial account and clears the checkpoint plus
 *  the pending-wallet record, so the new account starts showing in the switcher. The fallible
 *  step goes first: if the discard fails, the user is still on the working custodial session
 *  with the checkpoint intact, never stranded on an empty self-custodial account. Also
 *  surfaces the migration's checkpoint and account id from a single source of truth. */
export const useCompleteMigration = () => {
  const { checkpoint, accountId, loading, clearCheckpoint } =
    useMigrationCheckpointState()
  const { clearPendingAccount } = usePendingMigrationAccounts()
  const { setActiveAccountId, accounts } = useAccountRegistry()
  const { ownerId: custodialOwnerId } = useCustodialOwnerId()
  const { discardCustodialSession } = useDiscardCustodialSession()

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
    discardCustodialSession,
    clearCheckpoint,
    clearPendingAccount,
  ])

  return {
    migrationCheckpoint: checkpoint,
    migrationAccountId: accountId,
    migrationLoading: loading,
    completeMigration,
  }
}
