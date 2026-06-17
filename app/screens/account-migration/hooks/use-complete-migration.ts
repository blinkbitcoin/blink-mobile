import { useCallback } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"

import { useMigrationCheckpoint } from "./use-migration-checkpoint"

/** Switches the active session to the provisioned self-custodial account and clears the
 *  checkpoint; the custodial session is kept until the backend transfer lands. */
// TODO: tear down the custodial session here once the backend transfer is confirmed.
export const useCompleteMigration = () => {
  const { accountId, clearCheckpoint } = useMigrationCheckpoint()
  const { setActiveAccountId } = useAccountRegistry()

  const completeMigration = useCallback((): boolean => {
    if (!accountId) return false
    setActiveAccountId(accountId)
    clearCheckpoint()
    return true
  }, [accountId, setActiveAccountId, clearCheckpoint])

  return { migrationAccountId: accountId, completeMigration }
}
