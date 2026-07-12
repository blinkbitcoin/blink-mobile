/**
 * Orchestrates one recovery-bundle refresh: fetch from operators, encrypt with
 * the seed-derived key, persist to the device filesystem, then cloud sync.
 * Single-flight per account - payment bursts and manual refreshes share the
 * in-flight run instead of hammering the operators.
 *
 * Cloud sync follows the wallet's seed backup: the bundle is uploaded only
 * when the user completed a cloud seed backup (iCloud/Google Drive), and it
 * goes to the same provider. The uploaded payload is always the seed-encrypted
 * one, regardless of whether the seed backup itself used an extra password.
 */

import { type Network } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { networkLabelFor } from "../config"
import { isCloudSeedBackupCompleted, readBackupStateFor } from "../providers/backup-state"

import { attemptSilentCloudUpload, getRecoveryBundleFilename } from "./cloud"
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
 * Uploads the already-saved encrypted bundle to the seed backup's cloud
 * provider. No-op (false) when no cloud seed backup is set up, no bundle is
 * saved yet, or the silent upload fails. Used after each refresh and when the
 * user completes cloud seed backup with a bundle already on disk.
 */
export const syncExistingBundleToCloud = async (
  accountId: string,
  network: Network,
): Promise<boolean> => {
  const backupState = await readBackupStateFor(accountId)
  if (!isCloudSeedBackupCompleted(backupState)) return false

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
    crashlytics().log(`[recovery-bundle] silent cloud upload failed: ${upload.reason}`)
    return false
  }

  await markCloudSynced(accountId, network)
  return true
}

const inFlight = new Map<string, Promise<RefreshBundleResult>>()

const runRefresh = async ({
  accountId,
  network,
  mnemonic,
  appVersion,
}: RefreshBundleParams): Promise<RefreshBundleResult> => {
  try {
    const bundle = await fetchRecoveryBundle({ mnemonic, network, appVersion })
    const payload = await buildEncryptedBundlePayload(bundle, mnemonic)
    await saveEncryptedBundleFile(accountId, network, payload)

    const previous = await readRecoveryBundleState(accountId, network)
    const state: RecoveryBundleState = {
      savedAt: Date.now(),
      bundleCreatedAt: bundle.createdAt,
      leafCount: bundle.leaves.length,
      totalSats: bundle.balances.btcSats,
      cloudSyncedAt: previous?.cloudSyncedAt ?? null,
    }
    await writeRecoveryBundleState(accountId, network, state)

    await syncExistingBundleToCloud(accountId, network)

    const finalState = (await readRecoveryBundleState(accountId, network)) ?? state
    return { success: true, state: finalState }
  } catch (error) {
    return { success: false, error }
  }
}

export const refreshRecoveryBundle = (
  params: RefreshBundleParams,
): Promise<RefreshBundleResult> => {
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
