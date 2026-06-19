import { useCallback } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"

import { useDiscardCustodialSession } from "./use-discard-custodial-session"
import { useMigrationCheckpoint } from "./use-migration-checkpoint"

/** Switches the active session to the provisioned self-custodial account, discards the migrated
 *  custodial session so it no longer appears on the device, and clears the checkpoint. Also
 *  surfaces the migration's checkpoint and account id from a single source of truth. */
export const useCompleteMigration = () => {
  const { checkpoint, accountId, clearCheckpoint } = useMigrationCheckpoint()
  const { setActiveAccountId } = useAccountRegistry()
  const { discardCustodialSession } = useDiscardCustodialSession()

  const completeMigration = useCallback(async (): Promise<boolean> => {
    if (!accountId) return false
    setActiveAccountId(accountId)
    await discardCustodialSession()
    clearCheckpoint()
    return true
  }, [accountId, setActiveAccountId, discardCustodialSession, clearCheckpoint])

  return {
    migrationCheckpoint: checkpoint,
    migrationAccountId: accountId,
    completeMigration,
  }
}
