import { Platform } from "react-native"

import { loadJson, remove, saveJson } from "@app/utils/storage"

// Values are persisted to AsyncStorage — do not rename
export enum MigrationCheckpoint {
  BackupMethod = "backupMethod",
  CloudBackup = "cloudBackup",
  BackupAlerts = "backupAlerts",
}

type StoredCheckpoint = {
  step: MigrationCheckpoint
  savedAt: number
}

type ResumeRoute =
  | "sparkMigrationExplainer"
  | "sparkBackupMethodScreen"
  | "sparkCloudBackupScreen"
  | "sparkBackupAlertsScreen"

const STORAGE_KEY_PREFIX = "migrationCheckpoint"

const CHECKPOINT_EXPIRATION_MS = 48 * 60 * 60 * 1000 // 48h

const CHECKPOINT_ROUTE_MAP: Record<MigrationCheckpoint, ResumeRoute> = {
  [MigrationCheckpoint.BackupMethod]: "sparkBackupMethodScreen",
  [MigrationCheckpoint.CloudBackup]: "sparkCloudBackupScreen",
  [MigrationCheckpoint.BackupAlerts]: "sparkBackupAlertsScreen",
}

const DEFAULT_ROUTE: ResumeRoute = "sparkMigrationExplainer"

export const getStorageKey = (environment: string): string =>
  `${STORAGE_KEY_PREFIX}_${environment.toLowerCase()}`

export const isExpired = (
  checkpoint: StoredCheckpoint,
  now: number = Date.now(),
): boolean => now - checkpoint.savedAt > CHECKPOINT_EXPIRATION_MS

export const validateStoredCheckpoint = (raw: unknown): StoredCheckpoint | null => {
  if (!raw || typeof raw !== "object") return null

  const { step, savedAt } = raw as StoredCheckpoint

  if (!Object.values(MigrationCheckpoint).includes(step)) return null
  if (typeof savedAt !== "number") return null

  return { step, savedAt }
}

export const resolveCheckpointRoute = (
  checkpoint: MigrationCheckpoint | null,
): ResumeRoute => {
  if (!checkpoint) return DEFAULT_ROUTE

  if (checkpoint === MigrationCheckpoint.CloudBackup && Platform.OS === "ios") {
    return DEFAULT_ROUTE
  }

  return CHECKPOINT_ROUTE_MAP[checkpoint]
}

export const loadCheckpoint = async (
  storageKey: string,
): Promise<StoredCheckpoint | null> => {
  try {
    const raw = await loadJson(storageKey)
    const parsed = validateStoredCheckpoint(raw)

    if (!parsed) return null

    if (isExpired(parsed)) {
      await remove(storageKey)
      return null
    }

    return parsed
  } catch (err) {
    await remove(storageKey).catch(() => {})
    throw err
  }
}

export const saveCheckpointToStorage = async (
  storageKey: string,
  step: MigrationCheckpoint,
): Promise<void> => {
  await saveJson(storageKey, { step, savedAt: Date.now() })
}

export const clearCheckpointFromStorage = async (storageKey: string): Promise<void> => {
  await remove(storageKey)
}
