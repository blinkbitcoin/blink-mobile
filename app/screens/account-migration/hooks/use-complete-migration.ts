import { useCallback } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"

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
  const { activeAccount, setActiveAccountId } = useAccountRegistry()
  const { discardCustodialSession } = useDiscardCustodialSession()

  /** Captured before the swap: the pending record is keyed by the custodial owner, and
   *  after setActiveAccountId the active account is already the self-custodial one. */
  const custodialOwnerId = activeAccount?.id ?? null

  const completeMigration = useCallback(async (): Promise<boolean> => {
    if (!accountId) return false
    await discardCustodialSession()
    setActiveAccountId(accountId)
    clearCheckpoint()
    if (custodialOwnerId) clearPendingAccount(custodialOwnerId)
    return true
  }, [
    accountId,
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
