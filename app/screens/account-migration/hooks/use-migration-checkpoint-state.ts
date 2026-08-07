import { useCallback, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

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

import { useCustodialOwnerId } from "./use-custodial-owner-id"

/**
 * The persisted migration checkpoint's state and writes, free of any navigation
 * coupling so pure-logic consumers (backup routing, the session swap) can read the
 * resume state without instantiating a navigator-bound hook.
 */
export const useMigrationCheckpointState = () => {
  const { ownerId, loading: ownerLoading } = useCustodialOwnerId()
  const [stored, setStored] = useState<StoredCheckpoint | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const isFocusedRef = useRef(true)

  const {
    appConfig: {
      galoyInstance: { name: environment },
    },
  } = useAppConfig()

  const storageKey = getStorageKey(environment)

  /** The error only clears on a read that succeeds, never at the start of one: a retry
   *  that cleared it up front would hand consumers the still-empty state as settled data
   *  for the length of the read, and the gate would act on it (the handover this flag
   *  exists to hold back). Resolves instead of rejecting; the failure already traveled
   *  through reportError and hasError. */
  const load = useCallback(
    (): Promise<void> =>
      loadCheckpoint(storageKey)
        .then((storedCheckpoint) => {
          if (!isFocusedRef.current) return
          setStored(storedCheckpoint ?? null)
          setHasError(false)
          setLoading(false)
        })
        .catch((err) => {
          reportError("Checkpoint load", err)
          if (!isFocusedRef.current) return
          setHasError(true)
          setLoading(false)
        }),
    [storageKey],
  )

  const reloadCheckpoint = useCallback(() => {
    isFocusedRef.current = true

    load()

    return () => {
      isFocusedRef.current = false
    }
  }, [load])

  /** Reloads on every focus: the root blocker and the settings entry stay mounted below
   *  the flow while it advances, so a mount-only read would keep offering a restart
   *  after the user already has a resumable step. */
  useFocusEffect(reloadCheckpoint)

  /** A checkpoint belongs to the custodial account that saved it; another profile on the
   *  same device starts its own flow instead of resuming, and inheriting, this one. */
  const isOwnedByActiveAccount =
    !stored?.custodialAccountId || stored.custodialAccountId === ownerId
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
      /** Without a resolved owner the checkpoint cannot be keyed, and saving would erase the
       *  stored owner + account id via mergeCheckpoint; refuse so a null-owner window (an
       *  offline owner query) never wipes real progress. Callers gate on the false. */
      if (!ownerId) return false
      const update = {
        step,
        accountId: provisionedAccountId ?? accountId ?? undefined,
        custodialAccountId: ownerId,
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
    [storageKey, ownerId, accountId],
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
    /** The owner the record was actually saved under, null on one written before owners
     *  existed. Read by consumers that spend something irreversible, since the ownership
     *  flag above claims an owner-less record for whoever is active. */
    checkpointOwnerId: stored?.custodialAccountId ?? null,
    loading: loading || ownerLoading,
    /** A read failure surfaced, not swallowed: without it an unreadable store is
     *  indistinguishable from a wiped device, and the gate would hand a resumable user
     *  to support (terminal for that origin) on a transient storage error. */
    hasError,
    /** Imperative reload for retry screens. Leaves the focus flag alone on purpose: a
     *  retry resolving after blur still drops its update, same as the focus reload. */
    refetch: load,
    saveCheckpoint,
    clearCheckpoint,
    hasResumableCheckpoint,
  }
}
