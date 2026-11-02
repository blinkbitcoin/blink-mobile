/**
 * Orchestrates one recovery-bundle refresh: fetch from operators, encrypt with
 * the seed-derived key, persist to the device filesystem, then cloud sync.
 * Single-flight per account - payment bursts share the in-flight run instead
 * of hammering the operators.
 *
 * Every self-custodial wallet keeps its bundle on the device. Cloud sync
 * follows the wallet's seed backup and cannot be turned off: once the seed is
 * backed up to iCloud/Google Drive, with or without a passphrase, every saved
 * bundle is uploaded to the same provider. The uploaded payload is the same
 * seed-encrypted file kept on the device, so it is only as protected as the
 * seed backup beside it.
 *
 * Every refresh, upload and state write is registered per account,
 * so account deletion can refuse new work and wait for what is running before
 * its final sweep. Cloud operations run one at a time per account and network,
 * and state writes queue per account and network, so no two of them interleave.
 */

import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { CloudBackupErrorReason } from "@app/types/cloud-backup"
import { recordAppError, toError } from "@app/utils/error-reporting"

import { networkLabelFor } from "../config"
import { isCloudSeedBackupCompleted, readBackupStateFor } from "../providers/backup-state"

import {
  attemptSilentCloudUpload,
  getRecoveryBundleFilename,
  type SilentCloudResult,
} from "./cloud"
import { buildEncryptedBundlePayload, parseBundleBackupMetadata } from "./encryption"
import { fetchRecoveryBundle } from "./exporter"
import {
  loadEncryptedBundleFile,
  readRecoveryBundleState,
  saveEncryptedBundleFile,
  writeRecoveryBundleState,
  type RecoveryBundleState,
} from "./storage"

export type RefreshBundleParams = {
  accountId: string
  network: Network
  mnemonic: string
  appVersion: string
  /**
   * What wallet state this caller needs the bundle to cover - the payment event
   * key for a payment-triggered refresh.
   * Callers sharing a key are the same request arriving twice and share the run;
   * a different key means newer leaves the in-flight fetch never read, so it
   * earns a second pass. Omit it to accept whatever run is already going: the
   * staleness sweep only wants a current bundle and has no payment to cover.
   */
  coverageKey?: string
}

export type RefreshBundleResult =
  | { success: true; state: RecoveryBundleState }
  | { success: false; error: unknown }

/**
 * True when a saved bundle covers the latest known wallet change and is
 * younger than maxAgeMs. Pure so the staleness policy is testable without
 * timers or hooks.
 */
export const isBundleFresh = (
  state: RecoveryBundleState | null,
  now: number,
  maxAgeMs: number,
): boolean => {
  if (state === null) return false
  const isCoveringLatestChange = (state.uncoveredChangeAt ?? null) === null
  const isYoungerThanMaxAge = now - state.savedAt < maxAgeMs
  return isCoveringLatestChange && isYoungerThanMaxAge
}

// Account ids are random UUIDs and never reused. Membership lasts from the
// deletion mark until the post-deletion re-sweep unmarks it (see
// unmarkAccountDeletedForRefresh), so the set stays bounded by concurrent
// deletions rather than growing for the process lifetime.
const deletedAccounts = new Set<string>()

const accountDeletedError = (): Error => new Error("account deleted during refresh")

/** Keyed per (account, network) like the storage: work on one network must not
 *  be handed to, or queued behind, a caller on the other. */
const workKeyFor = (accountId: string, network: Network): string =>
  `${accountId}:${networkLabelFor(network)}`

const pendingWork = new Map<string, Set<Promise<unknown>>>()

/** Registers work with the account so deletion waits for it before its final sweep. */
const trackWork = <T>(accountId: string, work: Promise<T>): Promise<T> => {
  const accountWork = pendingWork.get(accountId) ?? new Set<Promise<unknown>>()
  pendingWork.set(accountId, accountWork)
  accountWork.add(work)
  const release = () => {
    accountWork.delete(work)
    const isLastWork =
      accountWork.size === 0 && pendingWork.get(accountId) === accountWork
    if (isLastWork) pendingWork.delete(accountId)
  }
  work.then(release, release)
  return work
}

/** Runs the task once the one queued before it under the same key settles, so
 *  tasks on a key never overlap; a failed task does not block the next. */
const enqueue = <T>(
  queues: Map<string, Promise<unknown>>,
  key: string,
  task: () => Promise<T>,
): Promise<T> => {
  const run = (queues.get(key) ?? Promise.resolve()).then(task)
  const settled = run.catch(() => undefined)
  queues.set(key, settled)
  settled.then(() => {
    if (queues.get(key) === settled) queues.delete(key)
  })
  return run
}

const stateUpdates = new Map<string, Promise<unknown>>()

/**
 * Read-modify-write of the state, queued per (account, network). A refresh
 * saving a new bundle and a cloud stamp for the previous one each read before
 * they write, so without the queue the later write would revert the earlier.
 * The update returns null to keep the stored state; nothing is written once
 * the account is marked deleted, which is checked right before the write.
 */
const updateState = (
  accountId: string,
  network: Network,
  update: (previous: RecoveryBundleState | null) => RecoveryBundleState | null,
): Promise<RecoveryBundleState | null> =>
  trackWork(
    accountId,
    enqueue(stateUpdates, workKeyFor(accountId, network), async () => {
      const next = update(await readRecoveryBundleState(accountId, network))
      const isWritable = next !== null && !deletedAccounts.has(accountId)
      if (!isWritable) return null
      await writeRecoveryBundleState(accountId, network, next)
      return next
    }),
  )

/**
 * Counts the changes marked per (account, network) in this process. A save
 * compares the count from before its fetch with the count at its write, rather
 * than the mark's time with the fetch's: the wall clock can move backwards, and
 * a mark dated ahead of every later fetch would then never clear.
 */
const markedChanges = new Map<string, number>()

const markedChangesFor = (key: string): number => markedChanges.get(key) ?? 0

/**
 * Records that the wallet changed in a way the saved bundle may not cover,
 * before any refresh is attempted. It is persisted, so a refresh that fails,
 * or never runs because the app closed first, still leaves the bundle reading
 * as not fresh; the first save whose fetch began after it clears it. Without a
 * saved bundle there is nothing to write: no bundle already reads as not fresh.
 */
export const markRecoveryBundleStale = async (
  accountId: string,
  network: Network,
): Promise<void> => {
  const key = workKeyFor(accountId, network)
  markedChanges.set(key, markedChangesFor(key) + 1)
  const changedAt = Date.now()
  await updateState(accountId, network, (previous) =>
    previous ? { ...previous, uncoveredChangeAt: changedAt } : null,
  )
}

/**
 * Records the bundle an upload carried. It names that payload's own
 * bundleCreatedAt, never the state saved now: a refresh can save a newer
 * bundle while an older payload is still uploading, and stamping the newer one
 * would claim a cloud copy that does not exist.
 */
const markCloudSynced = (
  accountId: string,
  network: Network,
  uploadedBundleCreatedAt: string,
): Promise<RecoveryBundleState | null> =>
  updateState(accountId, network, (previous) =>
    previous
      ? {
          ...previous,
          cloudSyncedAt: Date.now(),
          cloudSyncedBundleCreatedAt: uploadedBundleCreatedAt,
        }
      : null,
  )

/** The bundle goes to the cloud exactly when the seed is backed up there. */
const isCloudSyncDueFor = async (accountId: string): Promise<boolean> =>
  isCloudSeedBackupCompleted(await readBackupStateFor(accountId))

// Silent cloud failures that are user/device states, not defects - the same
// set the interactive Drive hook treats as expected (EXPECTED_DRIVE_REASONS in
// use-google-drive-backup.ts), plus Auth: on the silent path it means no
// usable cloud session (never linked, signed out, or a token revoked
// out-of-band), never a code defect.
const EXPECTED_SILENT_CLOUD_REASONS: ReadonlySet<CloudBackupErrorReason> = new Set([
  CloudBackupErrorReason.Auth,
  CloudBackupErrorReason.PermissionDenied,
  CloudBackupErrorReason.Cancelled,
  CloudBackupErrorReason.Transient,
])

/**
 * A remaining failure reason (Unknown) is a provider defect that must surface
 * as a standalone non-fatal carrying the original error - e.g. iCloud writes
 * breaking on a new iOS version.
 */
const recordSilentCloudFailure = (
  failure: Extract<SilentCloudResult, { success: false }>,
  operation: string,
): void => {
  const error =
    failure.error instanceof Error
      ? failure.error
      : new Error(`[recovery-bundle] silent cloud ${operation} failed: ${failure.reason}`)
  recordAppError(error, {
    expected: EXPECTED_SILENT_CLOUD_REASONS.has(failure.reason),
    dedupKey: `recovery-bundle-cloud-${operation}`,
  })
}

const cloudLocks = new Map<string, Promise<unknown>>()

/**
 * Runs a cloud operation for the account and network once any already running
 * for them settles, inside the deletion barrier. One at a time means an older
 * payload cannot finish uploading after a newer one. Resolves to undefined
 * without running the operation once the account is marked deleted.
 */
const withCloudBundleLock = <T>(
  accountId: string,
  network: Network,
  operation: () => Promise<T>,
): Promise<T | undefined> => {
  if (deletedAccounts.has(accountId)) return Promise.resolve(undefined)
  return trackWork(
    accountId,
    enqueue(cloudLocks, workKeyFor(accountId, network), async () =>
      deletedAccounts.has(accountId) ? undefined : operation(),
    ),
  )
}

const uploadSavedBundle = async (
  accountId: string,
  network: Network,
): Promise<boolean> => {
  if (!(await isCloudSyncDueFor(accountId))) return false

  const payload = await loadEncryptedBundleFile(accountId, network)
  if (!payload) return false
  const metadata = parseBundleBackupMetadata(payload)
  if (!metadata) {
    // A saved file that no longer parses means on-disk corruption, not an
    // expected state - record it, the refresh path will rewrite the file.
    recordAppError(new Error("[recovery-bundle] saved bundle payload failed to parse"), {
      dedupKey: "recovery-bundle-corrupt-payload",
    })
    return false
  }

  // Checked after the reads, right before the payload leaves the device: the
  // account may have been deleted while they were pending.
  if (deletedAccounts.has(accountId)) return false
  const upload = await attemptSilentCloudUpload(
    payload,
    getRecoveryBundleFilename(metadata.network, metadata.walletIdentityPublicKey),
  )
  if (!upload.success) {
    recordSilentCloudFailure(upload, "sync")
    return false
  }

  await markCloudSynced(accountId, network, metadata.bundleCreatedAt)
  return true
}

/**
 * Uploads the already-saved encrypted bundle to the seed backup's cloud
 * provider. No-op (false) when the seed is not backed up to the cloud, no
 * bundle is saved yet, the account is deleted, or the silent upload fails. The
 * payload is read inside the cloud lock, so it is the newest one saved when its
 * turn comes. Used after each refresh and when a cloud seed backup completes
 * with a bundle already on disk.
 */
export const syncExistingBundleToCloud = async (
  accountId: string,
  network: Network,
): Promise<boolean> => {
  const isSynced = await withCloudBundleLock(accountId, network, () =>
    uploadSavedBundle(accountId, network),
  )
  return isSynced === true
}

type InFlightRefresh = {
  run: Promise<RefreshBundleResult>
  coverageKey: string | undefined
}

const inFlight = new Map<string, InFlightRefresh>()

/** Reruns owed to callers that arrived mid-run needing newer state, coalesced
 *  one per key so a burst never queues more than a single extra pass. */
const queuedReruns = new Map<string, Promise<RefreshBundleResult>>()

/**
 * Marks an account as deleted so its work in flight (typically a refresh
 * mid-fetch, which takes seconds) refuses to persist or upload, and new work
 * is refused - otherwise the bundle file and state would reappear after the
 * deletion sweep, for an account no longer in the registry. Call before
 * sweeping the account's files.
 */
export const markAccountDeletedForRefresh = (accountId: string): void => {
  deletedAccounts.add(accountId)
}

/**
 * Resolves once every refresh, upload and state write registered
 * for the account (any network) has settled, a queued rerun included: it has
 * not started yet but will write once it does. Work already past its
 * deleted-account check can still land writes after the deletion sweep;
 * re-sweeping after this resolves closes that window. Work registered while
 * waiting is waited for too.
 */
export const waitForRefreshesToSettle = async (accountId: string): Promise<void> => {
  for (
    let accountWork = pendingWork.get(accountId);
    accountWork;
    accountWork = pendingWork.get(accountId)
  ) {
    await Promise.allSettled([...accountWork])
  }
}

/**
 * Drops the deletion mark once the post-deletion re-sweep has run: every
 * in-flight refresh has settled and its writes were swept, and nothing can
 * start a new refresh (the mnemonic and registry entry are gone - the hook
 * bails without a mnemonic, the export screen without an active account), so keeping
 * the id would only grow the set for the process lifetime.
 */
export const unmarkAccountDeletedForRefresh = (accountId: string): void => {
  deletedAccounts.delete(accountId)
}

const reportStaleMarkFailure = (err: unknown): void => {
  recordAppError(toError(err), { dedupKey: "recovery-bundle-stale-mark" })
}

const runRefresh = async ({
  accountId,
  network,
  mnemonic,
  appVersion,
}: RefreshBundleParams): Promise<RefreshBundleResult> => {
  let state: RecoveryBundleState
  try {
    await markRecoveryBundleStale(accountId, network)
    const changesBeforeFetch = markedChangesFor(workKeyFor(accountId, network))
    const bundle = await fetchRecoveryBundle({ mnemonic, network, appVersion })
    const payload = await buildEncryptedBundlePayload(bundle, mnemonic)

    // Checked after the slow network fetch, immediately before persisting:
    // the account may have been deleted while the fetch was in flight.
    if (deletedAccounts.has(accountId)) {
      return { success: false, error: accountDeletedError() }
    }
    await saveEncryptedBundleFile(accountId, network, payload)

    const saved = await updateState(accountId, network, (previous) => {
      /** A change marked after the fetch began may not be in this bundle. It
       *  is kept even on a first save, which no earlier mark could reach. */
      const isChangedDuringFetch =
        markedChangesFor(workKeyFor(accountId, network)) !== changesBeforeFetch
      return {
        savedAt: Date.now(),
        bundleCreatedAt: bundle.createdAt,
        leafCount: bundle.leaves.length,
        totalSats: bundle.balances.btcSats,
        cloudSyncedAt: previous?.cloudSyncedAt ?? null,
        cloudSyncedBundleCreatedAt: previous?.cloudSyncedBundleCreatedAt ?? null,
        uncoveredChangeAt: isChangedDuringFetch
          ? previous?.uncoveredChangeAt ?? Date.now()
          : null,
      }
    })
    if (!saved) return { success: false, error: accountDeletedError() }
    state = saved
  } catch (error) {
    return { success: false, error }
  }

  // Bundle freshness is decided by the save above; a failure in the cloud
  // step must not report an already-persisted refresh as failed. The sync's
  // own upload errors are handled inside it - this catch covers its
  // storage/settings reads throwing.
  try {
    await syncExistingBundleToCloud(accountId, network)
    const finalState = (await readRecoveryBundleState(accountId, network)) ?? state
    return { success: true, state: finalState }
  } catch (error) {
    recordAppError(toError(error), { dedupKey: "recovery-bundle-cloud-sync-step" })
    return { success: true, state }
  }
}

const startRun = (
  key: string,
  params: RefreshBundleParams,
): Promise<RefreshBundleResult> => {
  const run = runRefresh(params).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, { run, coverageKey: params.coverageKey })
  return trackWork(params.accountId, run)
}

export const refreshRecoveryBundle = (
  params: RefreshBundleParams,
): Promise<RefreshBundleResult> => {
  const { accountId, network } = params
  if (deletedAccounts.has(accountId)) {
    return Promise.resolve({ success: false, error: accountDeletedError() })
  }
  const key = workKeyFor(accountId, network)
  const current = inFlight.get(key)
  if (!current) return startRun(key, params)

  // The in-flight fetch read the leaves once, when it started. Handing its
  // result to a caller that needs newer state would drop those leaves from the
  // bundle for good: the save stamps savedAt, so the staleness path stops
  // covering them too.
  // A caller that names no coverage just wants a current bundle, so whatever is
  // already fetching serves it; only one naming state the in-flight fetch
  // cannot have read earns a second pass.
  const needsNewerState =
    params.coverageKey !== undefined && params.coverageKey !== current.coverageKey
  if (!needsNewerState) return current.run

  // The rerun covers this caller's change, but it starts only once the current
  // run settles; the mark keeps the bundle from reading as fresh until then,
  // even if the app closes first.
  markRecoveryBundleStale(accountId, network).catch(reportStaleMarkFailure)

  // One rerun serves every caller that arrived during this run, so a burst
  // costs a second pass rather than one per caller.
  const queued = queuedReruns.get(key)
  if (queued) return queued

  // allSettled, not the promise itself: the rerun is owed whether the run it
  // waits on succeeded or failed, and a rejection must not leave the queue
  // entry behind for the next caller to join.
  const rerun = Promise.allSettled([current.run]).then(() => {
    queuedReruns.delete(key)
    return refreshRecoveryBundle(params)
  })
  queuedReruns.set(key, rerun)
  return trackWork(accountId, rerun)
}
