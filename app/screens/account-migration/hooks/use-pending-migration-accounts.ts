import { useCallback } from "react"

import { reportError } from "@app/utils/error-logging"

import {
  clearPendingProvisionedAccount,
  savePendingProvisionedAccount,
} from "../utils/migration-checkpoint-storage"

import { useCustodialOwnerId } from "./use-custodial-owner-id"
import { usePendingProvisionedWallets } from "./use-pending-provisioned-wallets"

/**
 * Wallets provisioned for a migration but not yet activated, keyed by the custodial owner
 * (the real Galoy account id, so two profiles on one device stay separate). The record
 * never expires: a restarted flow reuses the owner's wallet instead of provisioning a
 * zombie, and the switcher hides every pending wallet until its migration activates it.
 *
 * It is also what marks a wallet as undeletable while it waits for the migration's funds,
 * so it is NOT dropped merely because its wallet became the active account: a user who
 * switched into the wallet by hand is exactly the case the mark has to survive. Only the
 * completing flow clears it by owner, or `clearPendingWallet` once the funds are proven to
 * have landed.
 *
 * This is the owner-aware half; usePendingProvisionedWallets holds the record itself, for
 * callers that have no use for the owner and should not pay for the query that finds it.
 */
export const usePendingMigrationAccounts = () => {
  const { ownerId, loading: ownerLoading } = useCustodialOwnerId()
  const {
    pendingAccountIds,
    pendingByOwner,
    setPendingByOwner,
    clearPendingWallet,
    loading,
    hasError,
    refetch,
    storageKey,
  } = usePendingProvisionedWallets()

  const pendingForActiveAccount = ownerId ? pendingByOwner[ownerId] ?? null : null

  /** Run as provision's beforeCreate, so it MUST throw on failure: a swallowed error (or a
   *  missing owner) would let the wallet be created with no record behind it, the orphan
   *  #6 guards against. The write lands before the in-memory update so a failed write
   *  leaves no phantom record either. The caller (ensureAccount) reports and toasts. */
  const savePendingAccount = useCallback(
    async (accountId: string): Promise<void> => {
      if (!ownerId) {
        throw new Error("Cannot record a pending migration account without an owner id")
      }
      await savePendingProvisionedAccount(storageKey, {
        custodialAccountId: ownerId,
        accountId,
      })
      setPendingByOwner((previous) => ({ ...previous, [ownerId]: accountId }))
    },
    [storageKey, ownerId, setPendingByOwner],
  )

  /** Memory follows the write, never leads it, for the same reason `clearPendingWallet`
   *  does: this record gates deletion and `deleteWallet` re-reads it from storage, so a map
   *  that reported the mark gone while the write failed would offer a delete control that
   *  then refuses, silently. */
  const clearPendingAccount = useCallback(
    async (custodialAccountId: string): Promise<void> => {
      try {
        await clearPendingProvisionedAccount(storageKey, custodialAccountId)
      } catch (err) {
        reportError("Pending migration account clear", err)
        return
      }

      setPendingByOwner((previous) => {
        const { [custodialAccountId]: cleared, ...rest } = previous
        return rest
      })
    },
    [storageKey, setPendingByOwner],
  )

  return {
    pendingAccountIds,
    pendingForActiveAccount,
    ownerId,
    savePendingAccount,
    clearPendingAccount,
    clearPendingWallet,
    loading: loading || ownerLoading,
    hasError,
    refetch,
  }
}
