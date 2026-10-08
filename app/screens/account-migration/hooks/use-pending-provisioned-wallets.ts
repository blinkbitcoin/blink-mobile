import { useCallback, useMemo, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useAppConfig } from "@app/hooks/use-app-config"
import { StorageReadStatus } from "@app/self-custodial/storage/account-index"
import { reportError } from "@app/utils/error-logging"

import {
  clearPendingProvisionedWallet,
  getPendingAccountsStorageKey,
  PendingRecordStatus,
  type PendingProvisionedAccountsRead,
  readPendingProvisionedAccounts,
  repairPendingProvisionedAccounts,
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

  /**
   * Nothing is recoverable from a corrupt value, and leaving it in place would block
   * provisioning and deletion alike for good, since only a write repairs it and writes run
   * only during a migration. So it is repaired where it is found, through the same per-key
   * queue as every other write, and the read that follows sees the empty record it has
   * become. Until that write lands the record stays unreadable, which is what `deleteWallet`
   * independently decides too: reporting it empty here is what would offer a delete control
   * that then refuses.
   */
  const readRecord = useCallback(async (): Promise<PendingProvisionedAccountsRead> => {
    const read = await readPendingProvisionedAccounts(storageKey)
    if (read.status !== PendingRecordStatus.Corrupt) return read

    reportError("Pending migration accounts repair", read.error, {
      dedupKey: "pending-migration-accounts-corrupt",
    })

    /** Deduped like the report above, and swallowed: this runs on every focus, with two
     *  hook instances mounted on the switcher, so a store that stays unwritable would file
     *  the same non-fatal twice per visit. The caller learns through the corrupt read it
     *  gets back. */
    try {
      await repairPendingProvisionedAccounts(storageKey)
    } catch (err) {
      reportError("Pending migration accounts repair", err, {
        dedupKey: "pending-migration-accounts-repair-failed",
      })
      return read
    }

    return readPendingProvisionedAccounts(storageKey)
  }, [storageKey])

  const load = useCallback(
    (): Promise<void> =>
      readRecord()
        .then((read) => {
          if (!isMountedRef.current) return

          if (read.status !== StorageReadStatus.Ok) {
            /** The cause travels, and only once: this read runs on every focus, and a store
             *  that stays broken would otherwise file the same unexplained report each time. */
            reportError("Pending migration accounts load", read.error, {
              dedupKey: "pending-migration-accounts-unreadable",
            })
            setHasError(true)
            setLoading(false)
            return
          }

          setPendingByOwner(read.pendingByOwner)
          setHasError(false)
          setLoading(false)
        })
        .catch((err) => {
          reportError("Pending migration accounts load", err)
          if (!isMountedRef.current) return
          setHasError(true)
          setLoading(false)
        }),
    [readRecord],
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
