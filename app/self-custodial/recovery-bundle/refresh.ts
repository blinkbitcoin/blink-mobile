/**
 * Orchestrates one recovery-bundle refresh: fetch from operators, encrypt with
 * the seed-derived key, persist to the device filesystem, then cloud sync.
 * Single-flight per account - payment bursts and manual refreshes share the
 * in-flight run instead of hammering the operators.
 *
 * Cloud sync follows the wallet's seed backup and is opt-in: the bundle is
 * uploaded only when the user enabled cloud sync AND completed a cloud seed
 * backup (iCloud/Google Drive) protected by an extra password, and it goes to
 * the same provider. The password gate exists because the uploaded payload is
 * seed-encrypted - next to an unencrypted seed in the same cloud account it
 * would be decryptable on the spot (blink-specs PRD rule D9).
 *
 * Every refresh, upload, state write and revocation is registered per account,
 * so account deletion can refuse new work and wait for what is running before
 * its final sweep. Cloud operations run one at a time per account and network,
 * and state writes queue per account and network, so no two of them interleave.
 */

import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { CloudBackupErrorReason } from "@app/types/cloud-backup"
import { recordAppError, toError } from "@app/utils/error-reporting"

import { networkLabelFor } from "../config"
import {
  isPasswordProtectedCloudSeedBackup,
  readBackupStateFor,
} from "../providers/backup-state"

import {
  attemptSilentCloudDelete,
  attemptSilentCloudUpload,
  getRecoveryBundleFilename,
  type SilentCloudResult,
} from "./cloud"
import { buildEncryptedBundlePayload, parseBundleBackupMetadata } from "./encryption"
import { fetchRecoveryBundle } from "./exporter"
import { deriveIdentityKeyPair } from "./identity"
import { readRecoveryBundleSettings, writeRecoveryBundleSettings } from "./settings"
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
 * would claim a cloud copy that does not exist. Shared by the silent sync below
 * and the screen's interactive upload so both paths stamp identically.
 */
export const markCloudSynced = (
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

/**
 * Single definition of "the bundle may be stored in the cloud": the user
 * opted in AND the cloud seed backup is password-protected (D9). Screen and
 * sync path both use this so they cannot diverge on it.
 */
export const isCloudSyncAllowedFor = async (accountId: string): Promise<boolean> => {
  const [settings, backupState] = await Promise.all([
    readRecoveryBundleSettings(accountId),
    readBackupStateFor(accountId),
  ])
  return settings.cloudSync && isPasswordProtectedCloudSeedBackup(backupState)
}

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
 * payload cannot finish uploading after a newer one, and a revocation's delete
 * cannot be overtaken by an upload that began before it. Resolves to undefined
 * without running the operation once the account is marked deleted.
 */
export const withCloudBundleLock = <T>(
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
  if (!(await isCloudSyncAllowedFor(accountId))) return false

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
 * provider. No-op (false) when cloud sync is not allowed (not opted in, or no
 * password-protected cloud seed backup), no bundle is saved yet, the account
 * is deleted, or the silent upload fails. The payload is read inside the cloud
 * lock, so it is the newest one saved when its turn comes. Used after each
 * refresh and when the user turns cloud sync on with a bundle already on disk.
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

const RECOVERY_BUNDLE_NETWORKS: readonly Network[] = [Network.Mainnet, Network.Regtest]

/** The cloud filename depends only on the network and the wallet's identity
 *  key, so it is derived from the seed rather than read from a saved bundle the
 *  device may no longer hold. */
const cloudFilenameFor = async (mnemonic: string, network: Network): Promise<string> => {
  const { publicKey } = await deriveIdentityKeyPair(mnemonic, network)
  return getRecoveryBundleFilename(
    networkLabelFor(network),
    Buffer.from(publicKey).toString("hex"),
  )
}

/** Resolves false rather than throwing, so the other network's delete still
 *  runs and the revocation reports the failure as a result. */
const deleteCloudCopy = async (
  accountId: string,
  network: Network,
  mnemonic: string,
): Promise<boolean> => {
  try {
    const fileName = await cloudFilenameFor(mnemonic, network)
    const deletion = await attemptSilentCloudDelete(fileName)
    if (!deletion.success) {
      recordSilentCloudFailure(deletion, "revoke")
      return false
    }
    await updateState(accountId, network, (previous) =>
      previous
        ? { ...previous, cloudSyncedAt: null, cloudSyncedBundleCreatedAt: null }
        : null,
    )
    return true
  } catch (err) {
    recordAppError(toError(err), { dedupKey: "recovery-bundle-cloud-revoke" })
    return false
  }
}

export type RevokeCloudBundleParams = {
  accountId: string
  mnemonic: string
}

/**
 * Removes the account's bundle from the cloud before its seed backup there is
 * replaced by one without a password, which would decrypt it (D9). The caller
 * must not upload that seed unless this resolves true.
 *
 * The opt-in is turned off first and durably, so no upload starts after this
 * one; uploads already running finish before the delete, which waits for the
 * cloud lock. Both networks' copies go, since the bundle key does not depend
 * on the network. The opt-in stays off even when a delete fails: putting the
 * value read earlier back could undo a change the user made meanwhile, and a
 * user whose seed backup is still protected can turn it on again. Never throws.
 */
export const revokeCloudRecoveryBundle = ({
  accountId,
  mnemonic,
}: RevokeCloudBundleParams): Promise<boolean> => {
  if (deletedAccounts.has(accountId)) return Promise.resolve(false)
  const revoke = async (): Promise<boolean> => {
    const settings = await readRecoveryBundleSettings(accountId)
    if (deletedAccounts.has(accountId)) return false
    await writeRecoveryBundleSettings(accountId, { ...settings, cloudSync: false })

    const deletions = await Promise.all(
      RECOVERY_BUNDLE_NETWORKS.map((network) =>
        withCloudBundleLock(accountId, network, () =>
          deleteCloudCopy(accountId, network, mnemonic),
        ),
      ),
    )
    return deletions.every((deleted) => deleted === true)
  }
  return trackWork(
    accountId,
    revoke().catch((err) => {
      recordAppError(toError(err), { dedupKey: "recovery-bundle-cloud-revoke" })
      return false
    }),
  )
}

const inFlight = new Map<string, Promise<RefreshBundleResult>>()

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
 * Resolves once every refresh, upload, state write and revocation registered
 * for the account (any network) has settled. Work already past its
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
 * bails without a mnemonic, the screen without an active account), so keeping
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

export const refreshRecoveryBundle = (
  params: RefreshBundleParams,
): Promise<RefreshBundleResult> => {
  const { accountId, network } = params
  if (deletedAccounts.has(accountId)) {
    return Promise.resolve({ success: false, error: accountDeletedError() })
  }
  const key = workKeyFor(accountId, network)
  const existing = inFlight.get(key)
  if (existing) {
    // This caller's change may have landed after the shared run's fetch began;
    // the mark keeps the bundle from reading as fresh until a save covers it.
    markRecoveryBundleStale(accountId, network).catch(reportStaleMarkFailure)
    return existing
  }

  const run = runRefresh(params).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, run)
  return trackWork(accountId, run)
}
