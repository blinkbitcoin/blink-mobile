import { useCallback } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"

import { usePendingMigrationAccounts } from "./use-pending-migration-accounts"

/**
 * Whether a wallet provisioned by an earlier abandoned migration run is still usable on
 * this device — the same predicate ensureAccount applies before reusing instead of
 * provisioning (see use-migration-account). The gate reads it to tell a resumable restart
 * (record and wallet both survived) from a wiped device (e.g. a reinstall), where a
 * restart could only provision another orphan (#4070).
 */
export const useReusablePendingWallet = (): {
  reusablePendingAccountId: string | null
  loading: boolean
  hasError: boolean
  refetch: () => Promise<unknown>
} => {
  const {
    pendingForActiveAccount,
    loading: pendingLoading,
    hasError,
    refetch: refetchPending,
  } = usePendingMigrationAccounts()
  const {
    accounts,
    loading: registryLoading,
    reloadSelfCustodialAccounts,
  } = useAccountRegistry()

  const reusablePendingAccountId =
    pendingForActiveAccount &&
    accounts.some((account) => account.id === pendingForActiveAccount)
      ? pendingForActiveAccount
      : null

  /** Both halves of the predicate reload together; the registry read never errors
   *  (a failed read keeps its prior entries), so hasError is the pending record's alone. */
  const refetch = useCallback(
    () => Promise.all([refetchPending(), reloadSelfCustodialAccounts()]),
    [refetchPending, reloadSelfCustodialAccounts],
  )

  return {
    reusablePendingAccountId,
    loading: pendingLoading || registryLoading,
    hasError,
    refetch,
  }
}
