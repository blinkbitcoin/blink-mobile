import { CommitPointRoute, ServerMigrationFlow } from "@app/types/migration"
import { loadJsonOrThrow, remove, saveJson } from "@app/utils/storage"

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
  /** Diagnostic only: no decision reads it since the record stopped expiring, the server's
   *  lock deciding instead. Still required by validation, which is what every record this
   *  app writes satisfies, so a record without it is malformed rather than half-trusted. */
  savedAt: number
  accountId?: string
  custodialAccountId?: string
  /** What the server's preview said the new wallet will receive, captured at the commit
   *  point — the only moment it is knowable (after the drain the preview reads an already
   *  emptied balance). Absent on records saved by app versions before the field existed. */
  expectedReceiveSats?: number
  /** Set once the server accepted this run's start, which the commit screen can reach
   *  after it records its step (the start waits on an emptied dollar balance, and can fail
   *  or be cut off). It is what tells a flow support cleared from one that never started:
   *  the server reads not started for both. Absent means not confirmed, never false. */
  isStartConfirmed?: true
}

/**
 * Where a checkpoint resumes. Every destination is a param-less route.
 */
type CheckpointDestination = {
  name: "accountMigrationExplainer" | "accountMigrationBalancesOverview"
}

const STORAGE_KEY_PREFIX = "migrationCheckpoint"

/** Where a flow with nothing to resume starts, and so where a restart lands. Narrowed to
 *  this one route so a restart can never be pointed at the commit screen by a change to
 *  the table below. */
export const RESTART_ROUTE = "accountMigrationExplainer" as const

const DEFAULT_DESTINATION: CheckpointDestination = { name: RESTART_ROUTE }

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

export const validateStoredCheckpoint = (raw: unknown): StoredCheckpoint | null => {
  if (!raw || typeof raw !== "object") return null

  const {
    step,
    savedAt,
    accountId,
    custodialAccountId,
    expectedReceiveSats,
    isStartConfirmed,
  } = raw as StoredCheckpoint

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
    /** Advisory too, and only a literal true counts: anything else reads as unconfirmed,
     *  which resumes, the behaviour a record written before the field existed gets. */
    isStartConfirmed: isStartConfirmed === true ? true : undefined,
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

/** Exhaustive on purpose: a server answer added later has no entry here and fails to
 *  compile, so it is routed deliberately instead of falling into a resume by default. */
const COMMIT_POINT_ROUTE_BY_FLOW: Record<
  Exclude<ServerMigrationFlow, typeof ServerMigrationFlow.NotStarted>,
  CommitPointRoute
> = {
  [ServerMigrationFlow.Open]: CommitPointRoute.Resume,
  [ServerMigrationFlow.Completed]: CommitPointRoute.AwaitSwap,
  [ServerMigrationFlow.Unanswered]: CommitPointRoute.AskAgain,
}

/**
 * What a commit-point checkpoint does given the server's answer, the one rule the entry
 * screen and the flow's step routing both follow. Not started is the only answer that
 * needs the device's side too: the server says it for a flow support cleared and for one
 * that never started, and only the first may start over. The second resumes, as it always
 * did, and the commit screen starts it.
 */
export const resolveCommitPointRoute = (
  flow: ServerMigrationFlow,
  isStartConfirmed: boolean,
): CommitPointRoute => {
  if (flow !== ServerMigrationFlow.NotStarted) return COMMIT_POINT_ROUTE_BY_FLOW[flow]
  return isStartConfirmed ? CommitPointRoute.Restart : CommitPointRoute.Resume
}

/**
 * Throws when the store cannot be read, so the caller can tell that apart from an empty
 * one: they are opposite situations (a record still on the device versus none at all) and
 * only one of them may end the migration at support (blink-wip#1211).
 *
 * A failed read leaves the record alone. Removing it here would turn a store that is
 * merely unreadable right now into the wiped device the gate cannot recover from, which
 * is the one outcome this flow can never take back.
 */
export const loadCheckpoint = async (
  storageKey: string,
): Promise<StoredCheckpoint | null> => {
  return validateStoredCheckpoint(await loadJsonOrThrow(storageKey))
}

export type CheckpointUpdate = {
  step: MigrationCheckpoint
  accountId?: string
  custodialAccountId?: string
  expectedReceiveSats?: number
  isStartConfirmed?: true
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

  /**
   * The expected receive is write-once for one owner's RUN of the flow: it is only knowable
   * before the drain, so a re-entered commit screen would carry the post-drain zero the
   * gate reads as "nothing will ever arrive" and swap while the funds are still in transit
   * (#4102).
   *
   * A run ends when the step falls back behind the commit point. The routing only does
   * that on a restart the server confirmed: the account reads not started after a start
   * this device saw accepted, which is support clearing the flow. An unanswered
   * server holds the user instead, and the backup screens that save a pre-commit step only
   * save while focused, so a screen left mounted beneath the commit point cannot regress it
   * either. On a restart the figure is dropped from both sides, the record and the update,
   * because callers re-send what they hold to heal a write that never landed and the
   * previous run's amount would otherwise ride back in. The next commit point supplies the
   * new run's own.
   *
   * The confirmed start belongs to the run the same way: kept across its steps, gone once
   * it restarts, since the new run has not started anything yet.
   */
  const hasRestarted =
    isCommitPointCheckpoint(existing?.step ?? null) &&
    !isCommitPointCheckpoint(update.step)
  const inheritedExpectedReceiveSats = hasSameOwner
    ? existing?.expectedReceiveSats
    : undefined
  const expectedReceiveSats = hasRestarted
    ? undefined
    : inheritedExpectedReceiveSats ?? update.expectedReceiveSats
  const inheritedStartConfirmation = hasSameOwner ? existing?.isStartConfirmed : undefined
  const isStartConfirmed = hasRestarted
    ? undefined
    : inheritedStartConfirmation ?? update.isStartConfirmed

  return {
    step: update.step,
    savedAt: Date.now(),
    accountId: update.accountId ?? (hasSameOwner ? existing?.accountId : undefined),
    custodialAccountId: update.custodialAccountId,
    expectedReceiveSats,
    isStartConfirmed,
  }
}

/**
 * Refuses rather than overwrites when the prior record cannot be read: merging against an
 * unreadable store would drop the accountId and expected receive it holds, and that save
 * is what turns a store the device could not read this once into progress genuinely lost.
 * The caller reports the throw and keeps the step unsaved, which is the recoverable half.
 */
export const saveCheckpointToStorage = async (
  storageKey: string,
  update: CheckpointUpdate,
): Promise<void> => {
  const existing = validateStoredCheckpoint(await loadJsonOrThrow(storageKey))
  await saveJson(storageKey, mergeCheckpoint(existing, update))
}

export const clearCheckpointFromStorage = async (storageKey: string): Promise<void> => {
  await remove(storageKey)
}

/**
 * Wallets provisioned for a migration but not yet activated, keyed by the custodial
 * account that started the flow. It never expires, and neither does the checkpoint: the
 * wallet exists (its phrase may already be written down), so a restarted flow must
 * reuse it instead of provisioning a zombie, and the account switcher must not offer it.
 */
type PendingProvisionedAccounts = Record<string, string>

const PENDING_ACCOUNTS_KEY_PREFIX = "migrationPendingAccounts"

export const getPendingAccountsStorageKey = (environment: string): string =>
  `${PENDING_ACCOUNTS_KEY_PREFIX}_${environment.toLowerCase()}`

/**
 * Throws on an unreadable store for the same reason loadCheckpoint does, and it matters
 * twice over: this record is the gate's second way to resume, so reading it as empty
 * retires the fallback meant to cover the first one being gone.
 */
export const loadPendingProvisionedAccounts = async (
  storageKey: string,
): Promise<PendingProvisionedAccounts> => {
  const raw = await loadJsonOrThrow(storageKey)
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
