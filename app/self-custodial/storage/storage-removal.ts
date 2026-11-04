import { Network } from "@breeztech/breez-sdk-spark-react-native"
import RNFS from "react-native-fs"

import { storageRootFor } from "../config"
import { recordErrorOnce } from "../logging"

/**
 * Removing a deleted wallet's SDK storage, durably. The storage holds the wallet's payment
 * history, and the SDK may still hold it, or recreate it, when the deletion's wait for the
 * SDK to go idle timed out. So a marker beside the directory records the removal before
 * anything irreversible happens, and the removal is retried when the SDK goes idle and at
 * the next launch, before any SDK connects.
 */

/** Present while a wallet's storage removal is pending; only its existence counts. */
export const STORAGE_REMOVAL_SUFFIX = ".removing"

const markerFor = (storageDir: string): string => `${storageDir}${STORAGE_REMOVAL_SUFFIX}`

const parentOf = (path: string): string => path.slice(0, path.lastIndexOf("/"))

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err))

const unlinkIfExists = async (path: string): Promise<void> => {
  if (await RNFS.exists(path)) await RNFS.unlink(path)
}

/** Records the removal. Call it before the wallet's mnemonic goes; rejects if it can't. */
export const markStorageForRemoval = async (storageDir: string): Promise<void> => {
  await RNFS.mkdir(parentOf(storageDir))
  await RNFS.writeFile(markerFor(storageDir), "", "utf8")
}

/** For a deletion that stopped before the wallet went: its storage must stay. */
export const unmarkStorageForRemoval = async (storageDir: string): Promise<void> => {
  await unlinkIfExists(markerFor(storageDir))
}

/** Removes the storage, then its marker, so a stop part-way leaves the marker to retry. */
export const removeMarkedStorage = async (storageDir: string): Promise<void> => {
  await unlinkIfExists(storageDir)
  await unlinkIfExists(markerFor(storageDir))
}

const removePendingIn = async (root: string): Promise<void> => {
  if (!(await RNFS.exists(root))) return
  const markers = (await RNFS.readDir(root)).filter(({ name }) =>
    name.endsWith(STORAGE_REMOVAL_SUFFIX),
  )
  for (const { path } of markers) {
    await removeMarkedStorage(path.slice(0, -STORAGE_REMOVAL_SUFFIX.length)).catch(
      (err) => recordErrorOnce("sdk-storage-removal", toError(err), { expected: true }),
    )
  }
}

let launchRemovals: Promise<void> | undefined

/**
 * Finishes every storage removal an earlier process left pending, once per launch: from
 * app start, and awaited by `initSdk` before it connects anything. Never rejects.
 */
export const finishPendingStorageRemovals = (): Promise<void> => {
  if (!launchRemovals) {
    launchRemovals = Promise.all(
      [Network.Mainnet, Network.Regtest].map((network) =>
        removePendingIn(storageRootFor(network)),
      ),
    )
      .then(() => undefined)
      .catch((err) =>
        recordErrorOnce("sdk-storage-removal", toError(err), { expected: true }),
      )
  }
  return launchRemovals
}
