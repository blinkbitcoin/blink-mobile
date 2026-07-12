/**
 * Local persistence for the encrypted recovery bundle: the payload lives on
 * the device filesystem (sibling of the Breez SDK storage dir, cleaned up on
 * account deletion), and lightweight refresh/cloud-sync state lives in
 * AsyncStorage for the UI.
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
  await RNFS.mkdir(recoveryBundleDirFor(network))
  await RNFS.writeFile(recoveryBundlePathFor(accountId, network), payload, "utf8")
}

export const loadEncryptedBundleFile = async (
  accountId: string,
  network: Network,
): Promise<string | null> => {
  const path = recoveryBundlePathFor(accountId, network)
  if (!(await RNFS.exists(path))) return null
  return RNFS.readFile(path, "utf8")
}

export const deleteRecoveryBundleFile = async (
  accountId: string,
  network: Network,
): Promise<void> => {
  const path = recoveryBundlePathFor(accountId, network)
  if (await RNFS.exists(path)) await RNFS.unlink(path)
}

// --- refresh/sync state (AsyncStorage) ---

const RECOVERY_BUNDLE_STATE_KEY_PREFIX = "recoveryBundleState"

const stateKeyFor = (accountId: string): string =>
  `${RECOVERY_BUNDLE_STATE_KEY_PREFIX}:${accountId}`

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
): Promise<RecoveryBundleState | null> => {
  const raw = await AsyncStorage.getItem(stateKeyFor(accountId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.savedAt !== "number") return null
    return parsed as RecoveryBundleState
  } catch {
    return null
  }
}

export const writeRecoveryBundleState = async (
  accountId: string,
  state: RecoveryBundleState,
): Promise<void> => {
  await AsyncStorage.setItem(stateKeyFor(accountId), JSON.stringify(state))
}

export const removeRecoveryBundleState = async (accountId: string): Promise<void> => {
  await AsyncStorage.removeItem(stateKeyFor(accountId))
}
