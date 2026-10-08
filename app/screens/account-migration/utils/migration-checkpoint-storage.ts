import AsyncStorage from "@react-native-async-storage/async-storage"

import { StorageReadStatus } from "@app/self-custodial/storage/account-index"
import { loadJson, remove, saveJson } from "@app/utils/storage"

/**
 * One turn at a time per storage key.
 *
 * Every writer below is a read, a change and a write back, and the record holds one entry
 * per owner. Two of them interleaving means the second reads the snapshot the first took
 * before its write landed, so whichever finishes last writes the other's entry away: a
 * wallet cleared while another is being saved comes back, or the saved one vanishes. Both
 * are silent, and one of them resurrects a mark that gates deletion.
 *
 * Per key rather than globally, because records under different keys share nothing. The
 * chain swallows the previous turn's failure so one rejected write cannot wedge the queue
 * for the rest of the session; each caller still sees its own.
 */
const writeQueuesByKey = new Map<string, Promise<unknown>>()

const queueOnKey = <T>(storageKey: string, run: () => Promise<T>): Promise<T> => {
  const previous = writeQueuesByKey.get(storageKey) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(run)
  writeQueuesByKey.set(
    storageKey,
    next.catch(() => undefined),
  )
  return next
}

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

const toPendingAccounts = (raw: unknown): PendingProvisionedAccounts => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  )
  return Object.fromEntries(entries)
}

export type PendingProvisionedAccountsRead =
  | { status: typeof StorageReadStatus.Ok; pendingByOwner: PendingProvisionedAccounts }
  /** Storage could not answer. What it holds is unknown, so it must not be overwritten. */
  | { status: typeof StorageReadStatus.ReadFailed; error: Error }
  /** Storage answered with something that is not a record. Nothing is recoverable from it,
   *  so a writer may repair it, while a reader deciding to destroy still may not act on it. */
  | { status: typeof PendingRecordStatus.Corrupt; error: Error }

export const PendingRecordStatus = { Corrupt: "corrupt" } as const

/**
 * The record, read strictly: a key that is absent is an empty record, while a read that
 * failed or a value that will not parse is reported as such rather than flattened into
 * "there is nothing pending".
 *
 * The only read of it, deliberately. This record gates a destructive action, and the shared
 * `loadJson` turns every failure into `null` by design, which is right for a reader deciding
 * what to show and wrong for one deciding whether to delete the only key to funds in flight.
 * Having the screens read it tolerantly while the deletion read strictly was worse than
 * either: the control would be offered and then refuse. AsyncStorage is reached directly
 * here because no tolerant helper can tell the two cases apart after the fact.
 *
 * The writers below read through it too: a write-back built on a failed read would persist
 * the caller's entry over a map it never actually saw, dropping other owners' marks.
 */
export const readPendingProvisionedAccounts = async (
  storageKey: string,
): Promise<PendingProvisionedAccountsRead> => {
  let raw: string | null
  try {
    raw = await AsyncStorage.getItem(storageKey)
  } catch (err) {
    return {
      status: StorageReadStatus.ReadFailed,
      error: err instanceof Error ? err : new Error(String(err)),
    }
  }

  /** Falsy rather than strictly null, matching what the tolerant loader treated as absent:
   *  an empty string is a key with nothing in it, not a record that will not parse. */
  if (!raw) return { status: StorageReadStatus.Ok, pendingByOwner: {} }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return {
      status: PendingRecordStatus.Corrupt,
      error: err instanceof Error ? err : new Error(String(err)),
    }
  }

  /** A value that parses but is not a record is corrupt just the same. Flattening it to an
   *  empty map would answer "nothing is pending" on a storage fault, which is the one
   *  answer that grants permission to delete. */
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      status: PendingRecordStatus.Corrupt,
      error: new Error("Pending migration accounts value is not a record"),
    }
  }

  return { status: StorageReadStatus.Ok, pendingByOwner: toPendingAccounts(parsed) }
}

/**
 * Overwrites a record nothing can be recovered from, so the device is not left with a value
 * that blocks provisioning and deletion alike with no way back.
 *
 * The decision is made again inside the queue, not carried into it: a mark written between
 * the caller's read and this turn would otherwise be wiped by a repair aimed at the value
 * it replaced, leaving a wallet mid-migration unmarked. A store that merely could not
 * answer is never repaired either, since it may still hold live marks.
 */
export const repairPendingProvisionedAccounts = async (
  storageKey: string,
): Promise<void> =>
  queueOnKey(storageKey, async () => {
    const current = await readPendingProvisionedAccounts(storageKey)
    if (current.status !== PendingRecordStatus.Corrupt) return

    await saveJson(storageKey, {})
  })

/**
 * What a writer may safely build its write-back on.
 *
 * A store that could not answer stops the write: overwriting it would persist this caller's
 * entry over a map it never saw, dropping other owners' marks. A value that is not a record
 * is different in kind, since nothing is recoverable from it and refusing would leave it
 * unrepairable for good, blocking provisioning and deletion alike with no way back. Writing
 * over that one is the repair.
 */
const readRecordForWrite = async (
  storageKey: string,
): Promise<PendingProvisionedAccounts> => {
  const read = await readPendingProvisionedAccounts(storageKey)
  if (read.status === StorageReadStatus.ReadFailed) {
    throw new Error("Pending migration accounts unreadable; refusing to overwrite")
  }
  if (read.status === PendingRecordStatus.Corrupt) return {}

  return read.pendingByOwner
}

export const savePendingProvisionedAccount = async (
  storageKey: string,
  update: { custodialAccountId: string; accountId: string },
): Promise<void> =>
  queueOnKey(storageKey, async () => {
    const existing = await readRecordForWrite(storageKey)

    await saveJson(storageKey, {
      ...existing,
      [update.custodialAccountId]: update.accountId,
    })
  })

/**
 * Clears by provisioned wallet rather than by owner, for the one caller that holds the
 * wallet id without the owner it was filed under: once the session is self-custodial the
 * custodial `me` query is skipped, so the owner id is unreachable. Every owner pointing at
 * the wallet is dropped, so a record duplicated across owners cannot leave half of it
 * behind.
 */
export const clearPendingProvisionedWallet = async (
  storageKey: string,
  accountId: string,
): Promise<void> =>
  queueOnKey(storageKey, async () => {
    const existing = await readRecordForWrite(storageKey)

    const remaining = Object.fromEntries(
      Object.entries(existing).filter(([, walletId]) => walletId !== accountId),
    )
    await saveJson(storageKey, remaining)
  })
