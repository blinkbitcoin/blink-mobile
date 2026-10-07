import { useCallback, useMemo, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useAppConfig } from "@app/hooks/use-app-config"
import { reportError } from "@app/utils/error-logging"

import {
  clearPendingProvisionedWallet,
  getPendingAccountsStorageKey,
  loadPendingProvisionedAccounts,
} from "../utils/migration-checkpoint-storage"

export type PendingProvisionedWallets = {
  /** Every provisioned wallet on the device, across owners. */
  pendingAccountIds: ReadonlySet<string>
  pendingByOwner: Record<string, string>
  setPendingByOwner: React.Dispatch<React.SetStateAction<Record<string, string>>>
  clearPendingWallet: (accountId: string) => Promise<void>
  loading: boolean
  hasError: boolean
  refetch: () => Promise<void>
  storageKey: string
}

/**
 * The stored record of wallets provisioned for a migration, read WITHOUT asking who owns
 * them. Which owner filed a wallet only matters for resuming a flow; the two questions this
 * answers, whether a wallet is provisioned and dropping that mark once its funds land, are
 * owner-agnostic.
 *
 * Kept separate from usePendingMigrationAccounts for that reason: the owner id comes from a
 * no-cache `me` query, and the deletion guard would otherwise fire one on every focus of
 * the account switcher to learn something it never reads.
 */
export const usePendingProvisionedWallets = (): PendingProvisionedWallets => {
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

  /**
   * Drops the mark for a wallet whose funds are already proven to have landed, without
   * needing the owner it was filed under: that id is unreachable once the session is
   * self-custodial, which is precisely when a stale mark would keep a settled wallet
   * undeletable for good.
   *
   * The in-memory map is updated only AFTER the write lands. This mark gates deletion, and
   * `deleteWallet` re-reads it from storage at the moment of deletion: a map that reported
   * the mark gone while the write failed would offer a delete control that then refuses,
   * silently.
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
    pendingByOwner,
    setPendingByOwner,
    clearPendingWallet,
    loading,
    /** A read failure surfaced, not swallowed: an unreadable record read as "no pending
     *  wallet" would tell the gate this device was wiped when it wasn't. */
    hasError,
    /** Imperative reload for retry screens; leaves the mount flag alone so a retry
     *  resolving after unmount still drops its update. */
    refetch: load,
    storageKey,
  }
}
