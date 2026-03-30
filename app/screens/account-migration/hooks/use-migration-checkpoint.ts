import { useCallback, useEffect, useState } from "react"

import { loadJson, remove, saveJson } from "@app/utils/storage"

const STORAGE_KEY = "migrationCheckpoint"
const SHORT_EXPIRATION_MS = 60 * 60 * 1000 // 1 hour
const DEFAULT_EXPIRATION_MS = 24 * SHORT_EXPIRATION_MS // 24 hours

export const MigrationCheckpoint = {
  BackupMethod: "backupMethod",
  CloudBackup: "cloudBackup",
  BackupAlerts: "backupAlerts",
} as const

export type MigrationCheckpointType =
  (typeof MigrationCheckpoint)[keyof typeof MigrationCheckpoint]

const checkpointExpirationMap: Record<MigrationCheckpointType, number> = {
  [MigrationCheckpoint.BackupMethod]: SHORT_EXPIRATION_MS,
  [MigrationCheckpoint.CloudBackup]: DEFAULT_EXPIRATION_MS,
  [MigrationCheckpoint.BackupAlerts]: DEFAULT_EXPIRATION_MS,
}

const checkpointRouteMap = {
  [MigrationCheckpoint.BackupMethod]: "sparkBackupMethodScreen",
  [MigrationCheckpoint.CloudBackup]: "sparkCloudBackupScreen",
  [MigrationCheckpoint.BackupAlerts]: "sparkBackupAlertsScreen",
} as const

type MigrationRoute =
  | "sparkMigrationExplainer"
  | (typeof checkpointRouteMap)[MigrationCheckpointType]

const DEFAULT_ROUTE: MigrationRoute = "sparkMigrationExplainer"

const validSteps = new Set<string>(Object.values(MigrationCheckpoint))

export const useMigrationCheckpoint = () => {
  const [checkpoint, setCheckpoint] = useState<MigrationCheckpointType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadJson(STORAGE_KEY).then((stored) => {
      const step = stored?.step
      const savedAt = stored?.savedAt

      if (!validSteps.has(step) || typeof savedAt !== "number") {
        setLoading(false)
        return
      }

      const typedStep = step as MigrationCheckpointType
      if (Date.now() - savedAt > checkpointExpirationMap[typedStep]) {
        remove(STORAGE_KEY)
        setLoading(false)
        return
      }

      setCheckpoint(typedStep)
      setLoading(false)
    })
  }, [])

  const saveCheckpoint = useCallback((step: MigrationCheckpointType) => {
    setCheckpoint(step)
    saveJson(STORAGE_KEY, { step, savedAt: Date.now() })
  }, [])

  const clearCheckpoint = useCallback(() => {
    setCheckpoint(null)
    remove(STORAGE_KEY)
  }, [])

  const getRouteForCheckpoint = useCallback((): MigrationRoute => {
    if (!checkpoint) return DEFAULT_ROUTE
    return checkpointRouteMap[checkpoint]
  }, [checkpoint])

  return { checkpoint, loading, saveCheckpoint, clearCheckpoint, getRouteForCheckpoint }
}
