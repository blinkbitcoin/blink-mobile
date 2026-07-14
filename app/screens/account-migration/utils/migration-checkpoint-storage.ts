import { Platform } from "react-native"

import { loadJson, remove, saveJson } from "@app/utils/storage"

/** Values are persisted to AsyncStorage: do not rename them. */
export enum MigrationCheckpoint {
  TermsAndConditions = "termsAndConditions",
  BackupMethod = "backupMethod",
  CloudBackup = "cloudBackup",
  BackupAlerts = "backupAlerts",
  BalancesOverview = "balancesOverview",
}

export type StoredCheckpoint = {
  step: MigrationCheckpoint
  savedAt: number
  accountId?: string
  custodialAccountId?: string
}

/**
 * Where a checkpoint resumes. Every destination is a param-less route except the
 * terms screen, which is shared across flows and needs the migration flow param.
 */
export type CheckpointDestination =
  | {
      name:
        | "accountMigrationExplainer"
        | "selfCustodialBackupMethod"
        | "selfCustodialCloudBackup"
        | "selfCustodialBackupSecurityChecks"
        | "accountMigrationBalancesOverview"
      params?: undefined
    }
  | { name: "acceptTermsAndConditions"; params: { flow: "migration" } }

const STORAGE_KEY_PREFIX = "migrationCheckpoint"

const CHECKPOINT_EXPIRATION_MS = 48 * 60 * 60 * 1000 // 48h

const CHECKPOINT_DESTINATION_MAP: Record<MigrationCheckpoint, CheckpointDestination> = {
  [MigrationCheckpoint.TermsAndConditions]: {
    name: "acceptTermsAndConditions",
    params: { flow: "migration" },
  },
  [MigrationCheckpoint.BackupMethod]: { name: "selfCustodialBackupMethod" },
  [MigrationCheckpoint.CloudBackup]: { name: "selfCustodialCloudBackup" },
  [MigrationCheckpoint.BackupAlerts]: { name: "selfCustodialBackupSecurityChecks" },
  [MigrationCheckpoint.BalancesOverview]: { name: "accountMigrationBalancesOverview" },
}

const DEFAULT_DESTINATION: CheckpointDestination = { name: "accountMigrationExplainer" }

export const getStorageKey = (environment: string): string =>
  `${STORAGE_KEY_PREFIX}_${environment.toLowerCase()}`

export const isExpired = (
  checkpoint: StoredCheckpoint,
  now: number = Date.now(),
): boolean => now - checkpoint.savedAt > CHECKPOINT_EXPIRATION_MS

export const validateStoredCheckpoint = (raw: unknown): StoredCheckpoint | null => {
  if (!raw || typeof raw !== "object") return null

  const { step, savedAt, accountId, custodialAccountId } = raw as StoredCheckpoint

  if (!Object.values(MigrationCheckpoint).includes(step)) return null
  if (typeof savedAt !== "number") return null
  if (accountId !== undefined && typeof accountId !== "string") return null
  if (custodialAccountId !== undefined && typeof custodialAccountId !== "string") {
    return null
  }

  return { step, savedAt, accountId, custodialAccountId }
}

export const resolveCheckpointRoute = (
  checkpoint: MigrationCheckpoint | null,
): CheckpointDestination => {
  if (!checkpoint) return DEFAULT_DESTINATION

  if (checkpoint === MigrationCheckpoint.CloudBackup && Platform.OS === "ios") {
    return DEFAULT_DESTINATION
  }

  return CHECKPOINT_DESTINATION_MAP[checkpoint]
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

export type CheckpointUpdate = {
  step: MigrationCheckpoint
  accountId?: string
  custodialAccountId?: string
}

/**
 * Builds the record for a step update: the provisioned accountId survives step-to-step
 * for resume, but never across a different custodial owner, so another profile's fresh
 * flow cannot inherit it. A record saved before owners existed is claimed by the first
 * account that saves onto it.
 */
export const mergeCheckpoint = (
  existing: StoredCheckpoint | null,
  update: CheckpointUpdate,
): StoredCheckpoint => {
  const hasSameOwner =
    existing?.custodialAccountId === undefined ||
    existing.custodialAccountId === update.custodialAccountId
  return {
    step: update.step,
    savedAt: Date.now(),
    accountId: update.accountId ?? (hasSameOwner ? existing?.accountId : undefined),
    custodialAccountId: update.custodialAccountId,
  }
}

export const saveCheckpointToStorage = async (
  storageKey: string,
  update: CheckpointUpdate,
): Promise<void> => {
  const existing = validateStoredCheckpoint(await loadJson(storageKey).catch(() => null))
  await saveJson(storageKey, mergeCheckpoint(existing, update))
}

export const clearCheckpointFromStorage = async (storageKey: string): Promise<void> => {
  await remove(storageKey)
}
