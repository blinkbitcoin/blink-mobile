/**
 * Local persistence for the encrypted recovery bundle: the payload lives on
 * the device filesystem (sibling of the Breez SDK storage dir, cleaned up on
 * account deletion), and lightweight refresh/cloud-sync state lives in
 * AsyncStorage for the UI.
 *
 * Filesystem rather than keychain is deliberate: the payload is already
 * AES-GCM encrypted with a seed-derived key (the seed itself lives in the
 * keychain), and a bundle can reach hundreds of KB, beyond practical keychain
 * item sizes on Android. The AsyncStorage state holds only non-secret
 * metadata (timestamps, leaf count).
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import { type Network } from "@breeztech/breez-sdk-spark-react-native"
import RNFS, { DocumentDirectoryPath } from "react-native-fs"

import { networkLabelFor } from "../config"

export const recoveryBundleDirFor = (network: Network): string =>
  `${DocumentDirectoryPath}/recovery-bundle-${networkLabelFor(network)}`

export const recoveryBundlePathFor = (accountId: string, network: Network): string =>
  `${recoveryBundleDirFor(network)}/${accountId}.json`

export const saveEncryptedBundleFile = async (
  accountId: string,
  network: Network,
  payload: string,
): Promise<void> => {
  // NSURLIsExcludedFromBackupKey: the bundle must not ride along in iOS
  // device backups - a passwordless iCloud seed backup in the same Apple
  // account would make it decryptable there (PRD rule D9). Android is covered
  // by allowBackup="false". No-op key on Android; reapplied on every call
  // since mkdir is idempotent.
  await RNFS.mkdir(recoveryBundleDirFor(network), {
    NSURLIsExcludedFromBackupKey: true,
  })
  const path = recoveryBundlePathFor(accountId, network)
  // Write-then-rename so an interrupted write cannot truncate the last good
  // bundle: writeFile in place truncates before writing, and the previous
  // copy is exactly what unilateral exit needs when re-fetching is not an
  // option. The unlink narrows atomicity (iOS moveFile refuses to overwrite),
  // but a crash in the gap still leaves the complete payload in the tmp file
  // rather than a truncated target.
  const tmpPath = `${path}.tmp`
  await RNFS.writeFile(tmpPath, payload, "utf8")
  if (await RNFS.exists(path)) await RNFS.unlink(path)
  await RNFS.moveFile(tmpPath, path)
}

export const loadEncryptedBundleFile = async (
  accountId: string,
  network: Network,
): Promise<string | null> => {
  const path = recoveryBundlePathFor(accountId, network)
  if (!(await RNFS.exists(path))) {
    // A crash between the atomic-save's unlink and rename leaves the payload
    // only in the tmp file; finish the rename instead of reporting no bundle.
    const tmpPath = `${path}.tmp`
    if (!(await RNFS.exists(tmpPath))) return null
    await RNFS.moveFile(tmpPath, path)
  }
  return RNFS.readFile(path, "utf8")
}

export const deleteRecoveryBundleFile = async (
  accountId: string,
  network: Network,
): Promise<void> => {
  const path = recoveryBundlePathFor(accountId, network)
  if (await RNFS.exists(path)) await RNFS.unlink(path)
  // A crash between the atomic-save's write and rename can strand a tmp file
  // holding the full encrypted payload; deletion must sweep it too.
  const tmpPath = `${path}.tmp`
  if (await RNFS.exists(tmpPath)) await RNFS.unlink(tmpPath)
}

// --- refresh/sync state (AsyncStorage) ---

const RECOVERY_BUNDLE_STATE_KEY_PREFIX = "recoveryBundleState"

// Keyed per (account, network) to mirror the bundle file: after a mainnet <->
// regtest instance switch the UI must not show the other network's freshness
// or suppress the staleness refresh with the wrong network's timestamp.
const stateKeyFor = (accountId: string, network: Network): string =>
  `${RECOVERY_BUNDLE_STATE_KEY_PREFIX}:${networkLabelFor(network)}:${accountId}`

export type RecoveryBundleState = {
  /** Unix ms of the last successful fetch+save. */
  savedAt: number
  /** The bundle's own createdAt (ISO). */
  bundleCreatedAt: string
  leafCount: number
  totalSats: string
  /** Unix ms of the last successful cloud upload, if any. */
  cloudSyncedAt: number | null
}

export const readRecoveryBundleState = async (
  accountId: string,
  network: Network,
): Promise<RecoveryBundleState | null> => {
  const raw = await AsyncStorage.getItem(stateKeyFor(accountId, network))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (
      typeof parsed?.savedAt !== "number" ||
      typeof parsed?.bundleCreatedAt !== "string" ||
      typeof parsed?.leafCount !== "number" ||
      typeof parsed?.totalSats !== "string" ||
      (parsed?.cloudSyncedAt !== null && typeof parsed?.cloudSyncedAt !== "number")
    ) {
      return null
    }
    return parsed as RecoveryBundleState
  } catch {
    return null
  }
}

export const writeRecoveryBundleState = async (
  accountId: string,
  network: Network,
  state: RecoveryBundleState,
): Promise<void> => {
  await AsyncStorage.setItem(stateKeyFor(accountId, network), JSON.stringify(state))
}

export const removeRecoveryBundleState = async (
  accountId: string,
  network: Network,
): Promise<void> => {
  await AsyncStorage.removeItem(stateKeyFor(accountId, network))
}
