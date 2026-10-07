import { useCallback, useMemo, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useAppConfig } from "@app/hooks/use-app-config"
import { reportError } from "@app/utils/error-logging"

import {
  clearPendingProvisionedAccount,
  clearPendingProvisionedWallet,
  getPendingAccountsStorageKey,
  loadPendingProvisionedAccounts,
  savePendingProvisionedAccount,
} from "../utils/migration-checkpoint-storage"

import { useCustodialOwnerId } from "./use-custodial-owner-id"

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
 */
export const usePendingMigrationAccounts = () => {
  const { ownerId, loading: ownerLoading } = useCustodialOwnerId()
  const [pendingByOwner, setPendingByOwner] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const isMountedRef = useRef(true)

  const {
    appConfig: {
      galoyInstance: { name: environment },
    },
  } = useAppConfig()

  const storageKey = getPendingAccountsStorageKey(environment)

  /** The error only clears on a read that succeeds, never at the start of one, so a retry
   *  never presents the still-empty map as settled data while the read is in flight.
   *  Resolves instead of rejecting; the failure already traveled through reportError and
   *  hasError. */
  const load = useCallback(
    (): Promise<void> =>
      loadPendingProvisionedAccounts(storageKey)
        .then((pending) => {
          if (!isMountedRef.current) return

          setPendingByOwner(pending)
          setHasError(false)
          setLoading(false)
        })
        .catch((err) => {
          reportError("Pending migration accounts load", err)
          if (!isMountedRef.current) return
          setHasError(true)
          setLoading(false)
        }),
    [storageKey],
  )

  const reloadPendingAccounts = useCallback(() => {
    isMountedRef.current = true

    load()

    return () => {
      isMountedRef.current = false
    }
  }, [load])

  useFocusEffect(reloadPendingAccounts)

  const pendingAccountIds = useMemo(
    () => new Set(Object.values(pendingByOwner)),
    [pendingByOwner],
  )
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
    [storageKey, ownerId],
  )

  /** Memory follows the write, never leads it: this record gates deletion and
   *  `deleteWallet` re-reads it from storage, so a map that reported the mark gone while
   *  the write failed would offer a delete control that then refuses, silently. */
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
    [storageKey],
  )

  /**
   * Drops the mark for a wallet whose funds are already proven to have landed, without
   * needing the owner it was filed under: that id is unreachable once the session is
   * self-custodial, which is precisely when a stale mark would keep a settled wallet
   * undeletable for good.
   */
  const clearPendingWallet = useCallback(
    async (accountId: string): Promise<void> => {
      try {
        await clearPendingProvisionedWallet(storageKey, accountId)
      } catch (err) {
        reportError("Pending migration wallet clear", err)
        return
      }

      setPendingByOwner((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([, walletId]) => walletId !== accountId),
        ),
      )
    },
    [storageKey],
  )

  return {
    pendingAccountIds,
    pendingForActiveAccount,
    ownerId,
    savePendingAccount,
    clearPendingAccount,
    clearPendingWallet,
    loading: loading || ownerLoading,
    /** A read failure surfaced, not swallowed: an unreadable record read as "no pending
     *  wallet" would tell the gate this device was wiped when it wasn't. */
    hasError,
    /** Imperative reload for retry screens; leaves the mount flag alone so a retry
     *  resolving after unmount still drops its update. */
    refetch: load,
  }
}
