import { useCallback, useEffect, useRef, useState } from "react"

import { useAppConfig } from "@app/hooks/use-app-config"

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

    loadCheckpoint(storageKey).then((stored) => {
      if (!mountedRef.current) return
      if (stored) setCheckpoint(stored.step)
      setLoading(false)
    })

    return () => {
      mountedRef.current = false
    }
  }, [storageKey])

  const saveCheckpoint = useCallback(
    (step: MigrationCheckpoint) => {
      setCheckpoint(step)
      saveCheckpointToStorage(storageKey, step)
    },
    [storageKey],
  )

  const clearCheckpoint = useCallback(() => {
    setCheckpoint(null)
    clearCheckpointFromStorage(storageKey)
  }, [storageKey])

  const getRouteForCheckpoint = useCallback(
    () => resolveCheckpointRoute(checkpoint),
    [checkpoint],
  )

  return { checkpoint, loading, saveCheckpoint, clearCheckpoint, getRouteForCheckpoint }
}
