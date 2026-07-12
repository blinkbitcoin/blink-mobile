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

import { BackupMethod, BackupStatus, readBackupStateFor } from "../providers/backup-state"

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

const isCloudSeedBackupActive = async (accountId: string): Promise<boolean> => {
  const backupState = await readBackupStateFor(accountId)
  return (
    backupState?.status === BackupStatus.Completed &&
    backupState.method === BackupMethod.Cloud
  )
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
  if (!(await isCloudSeedBackupActive(accountId))) return false

  const payload = await loadEncryptedBundleFile(accountId, network)
  if (!payload) return false
  const metadata = parseBundleBackupMetadata(payload)
  if (!metadata) return false

  const upload = await attemptSilentCloudUpload(
    payload,
    getRecoveryBundleFilename(metadata.network, metadata.walletIdentityPublicKey),
  )
  if (!upload.success) return false

  const state = await readRecoveryBundleState(accountId)
  if (state) {
    await writeRecoveryBundleState(accountId, { ...state, cloudSyncedAt: Date.now() })
  }
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
    const payload = buildEncryptedBundlePayload(bundle, mnemonic)
    await saveEncryptedBundleFile(accountId, network, payload)

    const previous = await readRecoveryBundleState(accountId)
    const state: RecoveryBundleState = {
      savedAt: Date.now(),
      bundleCreatedAt: bundle.createdAt,
      leafCount: bundle.leaves.length,
      totalSats: bundle.balances.btcSats,
      cloudSyncedAt: previous?.cloudSyncedAt ?? null,
    }
    await writeRecoveryBundleState(accountId, state)

    await syncExistingBundleToCloud(accountId, network)

    const finalState = (await readRecoveryBundleState(accountId)) ?? state
    return { success: true, state: finalState }
  } catch (error) {
    return { success: false, error }
  }
}

export const refreshRecoveryBundle = (
  params: RefreshBundleParams,
): Promise<RefreshBundleResult> => {
  const existing = inFlight.get(params.accountId)
  if (existing) return existing

  const run = runRefresh(params).finally(() => {
    inFlight.delete(params.accountId)
  })
  inFlight.set(params.accountId, run)
  return run
}
