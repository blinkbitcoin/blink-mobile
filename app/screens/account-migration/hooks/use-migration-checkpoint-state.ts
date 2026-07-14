import { useCallback, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useAppConfig } from "@app/hooks/use-app-config"
import { reportError } from "@app/utils/error-logging"

import {
  MigrationCheckpoint,
  type StoredCheckpoint,
  clearCheckpointFromStorage,
  getStorageKey,
  loadCheckpoint,
  mergeCheckpoint,
  saveCheckpointToStorage,
} from "../utils/migration-checkpoint-storage"

/**
 * The persisted migration checkpoint's state and writes, free of any navigation
 * coupling so pure-logic consumers (backup routing, the session swap) can read the
 * resume state without instantiating a navigator-bound hook.
 */
export const useMigrationCheckpointState = () => {
  const { activeAccount } = useAccountRegistry()
  const [stored, setStored] = useState<StoredCheckpoint | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const activeAccountId = activeAccount?.id ?? null

  const {
    appConfig: {
      galoyInstance: { name: environment },
    },
  } = useAppConfig()

  const storageKey = getStorageKey(environment)

  const reloadCheckpoint = useCallback(() => {
    mountedRef.current = true

    loadCheckpoint(storageKey)
      .then((storedCheckpoint) => {
        if (!mountedRef.current) return
        setStored(storedCheckpoint ?? null)
        setLoading(false)
      })
      .catch((err) => {
        reportError("Checkpoint load", err)
        if (!mountedRef.current) return
        setLoading(false)
      })

    return () => {
      mountedRef.current = false
    }
  }, [storageKey])

  /** Reloads on every focus: the root blocker and the settings entry stay mounted below
   *  the flow while it advances, so a mount-only read would keep offering a restart
   *  after the user already has a resumable step. */
  useFocusEffect(reloadCheckpoint)

  /** A checkpoint belongs to the custodial account that saved it; another profile on the
   *  same device starts its own flow instead of resuming, and inheriting, this one. */
  const isOwnedByActiveAccount =
    !stored?.custodialAccountId || stored.custodialAccountId === activeAccountId
  const checkpoint = isOwnedByActiveAccount ? stored?.step ?? null : null
  const accountId = isOwnedByActiveAccount ? stored?.accountId ?? null : null

  /** Resolves false when the write fails, so callers can stop the flow instead of
   *  advancing on a checkpoint that only exists in memory. Re-sending the known
   *  accountId lets a later successful save heal a write that failed. */
  const saveCheckpoint = useCallback(
    async (
      step: MigrationCheckpoint,
      provisionedAccountId?: string,
    ): Promise<boolean> => {
      const update = {
        step,
        accountId: provisionedAccountId ?? accountId ?? undefined,
        custodialAccountId: activeAccountId ?? undefined,
      }
      setStored((existing) => mergeCheckpoint(existing, update))
      try {
        await saveCheckpointToStorage(storageKey, update)
        return true
      } catch (err) {
        reportError("Checkpoint save", err)
        return false
      }
    },
    [storageKey, activeAccountId, accountId],
  )

  const clearCheckpoint = useCallback(() => {
    setStored(null)
    return clearCheckpointFromStorage(storageKey).catch((err) => {
      reportError("Checkpoint clear", err)
    })
  }, [storageKey])

  /** A provisioned account is only stored alongside a checkpoint, so it gates resumability. */
  const hasResumableCheckpoint = Boolean(accountId)

  return {
    checkpoint,
    accountId,
    loading,
    saveCheckpoint,
    clearCheckpoint,
    hasResumableCheckpoint,
  }
}
