import { useCallback, useEffect, useRef, useState } from "react"

import { useAppConfig } from "@app/hooks/use-app-config"
import { reportError } from "@app/utils/error-logging"

import {
  MigrationCheckpoint,
  clearCheckpointFromStorage,
  getStorageKey,
  loadCheckpoint,
  resolveCheckpointRoute,
  saveCheckpointToStorage,
} from "../utils/migration-checkpoint-storage"

export { MigrationCheckpoint }

export const useMigrationCheckpoint = () => {
  const [checkpoint, setCheckpoint] = useState<MigrationCheckpoint | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const {
    appConfig: {
      galoyInstance: { name: environment },
    },
  } = useAppConfig()

  const storageKey = getStorageKey(environment)

  useEffect(() => {
    mountedRef.current = true

    loadCheckpoint(storageKey)
      .then((stored) => {
        if (!mountedRef.current) return
        if (stored) {
          setCheckpoint(stored.step)
          setAccountId(stored.accountId ?? null)
        }
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

  const saveCheckpoint = useCallback(
    (step: MigrationCheckpoint, provisionedAccountId?: string) => {
      setCheckpoint(step)
      if (provisionedAccountId) setAccountId(provisionedAccountId)
      return saveCheckpointToStorage(storageKey, step, provisionedAccountId).catch(
        (err) => {
          reportError("Checkpoint save", err)
        },
      )
    },
    [storageKey],
  )

  const clearCheckpoint = useCallback(() => {
    setCheckpoint(null)
    setAccountId(null)
    clearCheckpointFromStorage(storageKey).catch(() => {})
  }, [storageKey])

  // Without a provisioned account, resume from the explainer so it gets provisioned.
  const getRouteForCheckpoint = useCallback(
    () => resolveCheckpointRoute(accountId ? checkpoint : null),
    [checkpoint, accountId],
  )

  // A provisioned account is only stored alongside a checkpoint, so it gates resumability.
  const hasResumableCheckpoint = Boolean(accountId)

  return {
    checkpoint,
    accountId,
    loading,
    saveCheckpoint,
    clearCheckpoint,
    getRouteForCheckpoint,
    hasResumableCheckpoint,
  }
}
