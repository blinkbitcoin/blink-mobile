import { useCallback } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"

import { useDiscardCustodialSession } from "./use-discard-custodial-session"
import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"

/** Discards the migrated custodial session so it no longer appears on the device, then switches
 *  the active session to the provisioned self-custodial account and clears the checkpoint. The
 *  fallible step goes first: if the discard fails, the user is still on the working custodial
 *  session with the checkpoint intact, never stranded on an empty self-custodial account. Also
 *  surfaces the migration's checkpoint and account id from a single source of truth. */
export const useCompleteMigration = () => {
  const { checkpoint, accountId, loading, clearCheckpoint } =
    useMigrationCheckpointState()
  const { setActiveAccountId } = useAccountRegistry()
  const { discardCustodialSession } = useDiscardCustodialSession()

  const completeMigration = useCallback(async (): Promise<boolean> => {
    if (!accountId) return false
    await discardCustodialSession()
    setActiveAccountId(accountId)
    clearCheckpoint()
    return true
  }, [accountId, setActiveAccountId, discardCustodialSession, clearCheckpoint])

  return {
    migrationCheckpoint: checkpoint,
    migrationAccountId: accountId,
    migrationLoading: loading,
    completeMigration,
  }
}
