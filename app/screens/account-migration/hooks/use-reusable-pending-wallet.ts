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
} => {
  const { pendingForActiveAccount, loading: pendingLoading } =
    usePendingMigrationAccounts()
  const { accounts, loading: registryLoading } = useAccountRegistry()

  const reusablePendingAccountId =
    pendingForActiveAccount &&
    accounts.some((account) => account.id === pendingForActiveAccount)
      ? pendingForActiveAccount
      : null

  return { reusablePendingAccountId, loading: pendingLoading || registryLoading }
}
