import { loadJson, remove, saveJson } from "@app/utils/storage"

/** Values are persisted to AsyncStorage: do not rename them. */
export enum MigrationCheckpoint {
  TermsAndConditions = "termsAndConditions",
  BackupMethod = "backupMethod",
  CloudBackup = "cloudBackup",
  BackupAlerts = "backupAlerts",
  ChooseExperience = "chooseExperience",
  BalancesOverview = "balancesOverview",
}

export type StoredCheckpoint = {
  step: MigrationCheckpoint
  savedAt: number
  accountId?: string
  custodialAccountId?: string
  /** What the server's preview said the new wallet will receive, captured at the commit
   *  point — the only moment it is knowable (after the drain the preview reads an already
   *  emptied balance). Absent on records saved by app versions before the field existed. */
  expectedReceiveSats?: number
}

/**
 * Where a checkpoint resumes. Every destination is a param-less route.
 */
type CheckpointDestination = {
  name: "accountMigrationExplainer" | "accountMigrationBalancesOverview"
}

const STORAGE_KEY_PREFIX = "migrationCheckpoint"

const CHECKPOINT_EXPIRATION_MS = 48 * 60 * 60 * 1000 // 48h

const DEFAULT_DESTINATION: CheckpointDestination = { name: "accountMigrationExplainer" }

/** Exhaustive on purpose: a step added to the enum has no entry here and fails to compile,
 *  so a checkpoint past the commit point can never inherit the restart by omission. */
const IS_COMMIT_POINT_BY_CHECKPOINT: Record<MigrationCheckpoint, boolean> = {
  [MigrationCheckpoint.TermsAndConditions]: false,
  [MigrationCheckpoint.BackupMethod]: false,
  [MigrationCheckpoint.CloudBackup]: false,
  [MigrationCheckpoint.BackupAlerts]: false,
  [MigrationCheckpoint.ChooseExperience]: false,
  [MigrationCheckpoint.BalancesOverview]: true,
}

/** The commit point is the only step a reopened flow jumps forward to: the balances screen
 *  already claimed the account server-side, so re-walking backup ahead of it would offer a
 *  transfer the user cannot decline. The route resolver and the entry screen both read this
 *  one predicate, so the destination and the decision to resume can never disagree. */
export const isCommitPointCheckpoint = (
  checkpoint: MigrationCheckpoint | null,
): boolean => checkpoint !== null && IS_COMMIT_POINT_BY_CHECKPOINT[checkpoint]

export const getStorageKey = (environment: string): string =>
  `${STORAGE_KEY_PREFIX}_${environment.toLowerCase()}`

export const isExpired = (
  checkpoint: StoredCheckpoint,
  now: number = Date.now(),
): boolean => now - checkpoint.savedAt > CHECKPOINT_EXPIRATION_MS

export const validateStoredCheckpoint = (raw: unknown): StoredCheckpoint | null => {
  if (!raw || typeof raw !== "object") return null

  const { step, savedAt, accountId, custodialAccountId, expectedReceiveSats } =
    raw as StoredCheckpoint

  if (!Object.values(MigrationCheckpoint).includes(step)) return null
  if (typeof savedAt !== "number") return null
  if (accountId !== undefined && typeof accountId !== "string") return null
  if (custodialAccountId !== undefined && typeof custodialAccountId !== "string") {
    return null
  }
  /** Advisory, unlike the fields above: dropping a malformed one on its own keeps the step
   *  and ids a locked account resumes from, which discarding the record would strip. */
  const hasUsableExpectedReceiveSats =
    typeof expectedReceiveSats === "number" && Number.isFinite(expectedReceiveSats)

  return {
    step,
    savedAt,
    accountId,
    custodialAccountId,
    expectedReceiveSats: hasUsableExpectedReceiveSats ? expectedReceiveSats : undefined,
  }
}

/** Only the commit point resumes mid-flow; every earlier step restarts at the explainer,
 *  so the user re-walks terms and backup before the funds transfer is offered again. The
 *  restart may not target the migration gate: the gate walks into the rest of the flow
 *  through this same resolver, so pointing a pre-commit checkpoint back at it closes a
 *  cycle the user cannot leave. */
export const resolveCheckpointRoute = (
  checkpoint: MigrationCheckpoint | null,
): CheckpointDestination =>
  isCommitPointCheckpoint(checkpoint)
    ? { name: "accountMigrationBalancesOverview" }
    : DEFAULT_DESTINATION

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
  expectedReceiveSats?: number
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

  /** Write-once for one owner's flow: the figure is only knowable before the drain, so a
   *  re-entered commit screen would carry the post-drain zero the gate reads as "nothing
   *  will ever arrive" and swap while the funds are still in transit (#4102). */
  const inheritedExpectedReceiveSats = hasSameOwner
    ? existing?.expectedReceiveSats
    : undefined

  return {
    step: update.step,
    savedAt: Date.now(),
    accountId: update.accountId ?? (hasSameOwner ? existing?.accountId : undefined),
    custodialAccountId: update.custodialAccountId,
    expectedReceiveSats: inheritedExpectedReceiveSats ?? update.expectedReceiveSats,
  }
}

export const saveCheckpointToStorage = async (
  storageKey: string,
  update: CheckpointUpdate,
): Promise<void> => {
  const stored = validateStoredCheckpoint(await loadJson(storageKey).catch(() => null))
  /** An expired prior record must not lend its accountId to the fresh save; treat it as
   *  absent, matching loadCheckpoint, so the 48h expiry stays authoritative for the id. */
  const isReusableRecord = stored !== null && !isExpired(stored)
  const existing = isReusableRecord ? stored : null
  await saveJson(storageKey, mergeCheckpoint(existing, update))
}

export const clearCheckpointFromStorage = async (storageKey: string): Promise<void> => {
  await remove(storageKey)
}

/**
 * Wallets provisioned for a migration but not yet activated, keyed by the custodial
 * account that started the flow. Unlike the checkpoint this record never expires: the
 * wallet exists (its phrase may already be written down), so a restarted flow must
 * reuse it instead of provisioning a zombie, and the account switcher must not offer it.
 */
type PendingProvisionedAccounts = Record<string, string>

const PENDING_ACCOUNTS_KEY_PREFIX = "migrationPendingAccounts"

export const getPendingAccountsStorageKey = (environment: string): string =>
  `${PENDING_ACCOUNTS_KEY_PREFIX}_${environment.toLowerCase()}`

export const loadPendingProvisionedAccounts = async (
  storageKey: string,
): Promise<PendingProvisionedAccounts> => {
  const raw = await loadJson(storageKey).catch(() => null)
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  )
  return Object.fromEntries(entries)
}

export const savePendingProvisionedAccount = async (
  storageKey: string,
  update: { custodialAccountId: string; accountId: string },
): Promise<void> => {
  const existing = await loadPendingProvisionedAccounts(storageKey)
  await saveJson(storageKey, {
    ...existing,
    [update.custodialAccountId]: update.accountId,
  })
}

export const clearPendingProvisionedAccount = async (
  storageKey: string,
  custodialAccountId: string,
): Promise<void> => {
  const existing = await loadPendingProvisionedAccounts(storageKey)
  const { [custodialAccountId]: cleared, ...rest } = existing
  await saveJson(storageKey, rest)
}
