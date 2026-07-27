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
 */

import { type Network } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { CloudBackupErrorReason } from "@app/types/cloud-backup"

import { networkLabelFor } from "../config"
import {
  isPasswordProtectedCloudSeedBackup,
  readBackupStateFor,
} from "../providers/backup-state"

import { attemptSilentCloudUpload, getRecoveryBundleFilename } from "./cloud"
import { buildEncryptedBundlePayload, parseBundleBackupMetadata } from "./encryption"
import { fetchRecoveryBundle } from "./exporter"
import { readRecoveryBundleSettings } from "./settings"
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

/** True when a saved bundle exists and is younger than maxAgeMs. Pure so the
 * staleness policy is testable without timers or hooks. */
export const isBundleFresh = (
  state: RecoveryBundleState | null,
  now: number,
  maxAgeMs: number,
): boolean => state !== null && now - state.savedAt < maxAgeMs

/**
 * Stamps the last successful cloud upload. Shared by the silent sync below
 * and the screen's interactive upload so both paths stamp identically.
 * (runRefresh also carries the previous stamp forward in its own write, so a
 * stamp landing between its read and write can be reverted until the next
 * successful sync - UI-freshness only, self-healing.)
 */
export const markCloudSynced = async (
  accountId: string,
  network: Network,
): Promise<RecoveryBundleState | null> => {
  const state = await readRecoveryBundleState(accountId, network)
  if (!state) return null
  const next = { ...state, cloudSyncedAt: Date.now() }
  await writeRecoveryBundleState(accountId, network, next)
  return next
}

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

/**
 * Uploads the already-saved encrypted bundle to the seed backup's cloud
 * provider. No-op (false) when cloud sync is not allowed (not opted in, or no
 * password-protected cloud seed backup), no bundle is saved yet, or the
 * silent upload fails. Used after each refresh and when the user turns cloud
 * sync on with a bundle already on disk.
 */
export const syncExistingBundleToCloud = async (
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
    crashlytics().recordError(
      new Error("[recovery-bundle] saved bundle payload failed to parse"),
    )
    return false
  }

  const upload = await attemptSilentCloudUpload(
    payload,
    getRecoveryBundleFilename(metadata.network, metadata.walletIdentityPublicKey),
  )
  if (!upload.success) {
    if (upload.reason === CloudBackupErrorReason.Auth) {
      // Expected state: the user never linked a cloud account on this device.
      crashlytics().log(`[recovery-bundle] silent cloud upload skipped: ${upload.reason}`)
    } else {
      // recordError, not a breadcrumb: a provider failure that starts hitting
      // every user (e.g. iCloud writes breaking on a new iOS version) must
      // show up as standalone Crashlytics events carrying the original error,
      // not be visible only when attached to some later recorded error.
      const wrapped =
        upload.error instanceof Error
          ? upload.error
          : new Error(`[recovery-bundle] silent cloud upload failed: ${upload.reason}`)
      crashlytics().recordError(wrapped, "recovery-bundle-cloud-sync")
    }
    return false
  }

  await markCloudSynced(accountId, network)
  return true
}

const inFlight = new Map<string, Promise<RefreshBundleResult>>()

// Account ids are random UUIDs and never reused. Membership lasts from the
// deletion mark until the post-deletion re-sweep unmarks it (see
// unmarkAccountDeletedForRefresh), so the set stays bounded by concurrent
// deletions rather than growing for the process lifetime.
const deletedAccounts = new Set<string>()

/**
 * Marks an account as deleted so an in-flight refresh (typically mid-fetch,
 * which takes seconds) refuses to persist its result - otherwise the bundle
 * file and state would reappear after the deletion sweep, for an account no
 * longer in the registry. Call before sweeping the account's files.
 */
export const markAccountDeletedForRefresh = (accountId: string): void => {
  deletedAccounts.add(accountId)
}

/**
 * Resolves once every in-flight refresh for the account (any network) has
 * settled. A refresh already past its deleted-account check can still land
 * writes after the deletion sweep; re-sweeping after this resolves closes
 * that window.
 */
export const waitForRefreshesToSettle = async (accountId: string): Promise<void> => {
  const runs = [...inFlight.entries()]
    .filter(([key]) => key.startsWith(`${accountId}:`))
    .map(([, run]) => run)
  await Promise.allSettled(runs)
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

const runRefresh = async ({
  accountId,
  network,
  mnemonic,
  appVersion,
}: RefreshBundleParams): Promise<RefreshBundleResult> => {
  let state: RecoveryBundleState
  try {
    const bundle = await fetchRecoveryBundle({ mnemonic, network, appVersion })
    const payload = await buildEncryptedBundlePayload(bundle, mnemonic)

    // Checked after the slow network fetch, immediately before persisting:
    // the account may have been deleted while the fetch was in flight.
    if (deletedAccounts.has(accountId)) {
      return { success: false, error: new Error("account deleted during refresh") }
    }
    await saveEncryptedBundleFile(accountId, network, payload)

    const previous = await readRecoveryBundleState(accountId, network)
    state = {
      savedAt: Date.now(),
      bundleCreatedAt: bundle.createdAt,
      leafCount: bundle.leaves.length,
      totalSats: bundle.balances.btcSats,
      cloudSyncedAt: previous?.cloudSyncedAt ?? null,
    }
    await writeRecoveryBundleState(accountId, network, state)
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
    crashlytics().recordError(
      error instanceof Error ? error : new Error(String(error)),
      "recovery-bundle-cloud-sync",
    )
    return { success: true, state }
  }
}

export const refreshRecoveryBundle = (
  params: RefreshBundleParams,
): Promise<RefreshBundleResult> => {
  if (deletedAccounts.has(params.accountId)) {
    return Promise.resolve({
      success: false,
      error: new Error("account deleted during refresh"),
    })
  }
  // Keyed per (account, network) like the storage: a refresh started on one
  // network must not be handed to a caller on the other after an instance
  // switch.
  const key = `${params.accountId}:${networkLabelFor(params.network)}`
  const existing = inFlight.get(key)
  if (existing) return existing

  const run = runRefresh(params).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, run)
  return run
}
