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
        if (stored) setCheckpoint(stored.step)
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
    (step: MigrationCheckpoint) => {
      setCheckpoint(step)
      saveCheckpointToStorage(storageKey, step).catch((err) => {
        reportError("Checkpoint save", err)
      })
    },
    [storageKey],
  )

  const clearCheckpoint = useCallback(() => {
    setCheckpoint(null)
    clearCheckpointFromStorage(storageKey).catch(() => {})
  }, [storageKey])

  const getRouteForCheckpoint = useCallback(
    () => resolveCheckpointRoute(checkpoint),
    [checkpoint],
  )

  return { checkpoint, loading, saveCheckpoint, clearCheckpoint, getRouteForCheckpoint }
}
