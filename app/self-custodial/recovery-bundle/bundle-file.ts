/**
 * Reading an emergency bundle the user points at in the OS file picker.
 *
 * Kept behind one function so the rest of the flow never touches the picker:
 * cloud, clipboard and file all hand the same string to the same verifier, and
 * a fourth source later is a fourth caller rather than a fourth code path.
 */

import RNFS from "react-native-fs"

import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
} from "@react-native-documents/picker"

export const BundleFilePickStatus = {
  Picked: "picked",
  /** User backed out of the picker; not a failure, and not worth a toast. */
  Cancelled: "cancelled",
  Unreadable: "unreadable",
} as const

export type BundleFilePickStatus =
  (typeof BundleFilePickStatus)[keyof typeof BundleFilePickStatus]

export type BundleFilePick =
  | { status: typeof BundleFilePickStatus.Picked; content: string }
  | { status: typeof BundleFilePickStatus.Cancelled }
  | { status: typeof BundleFilePickStatus.Unreadable }

const FALLBACK_FILE_NAME = "emergency-bundle.json"

export const pickEmergencyBundleFile = async (): Promise<BundleFilePick> => {
  let uri: string
  let name: string | null
  try {
    ;[{ uri, name }] = await pick()
  } catch (err) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
      return { status: BundleFilePickStatus.Cancelled }
    }
    return { status: BundleFilePickStatus.Unreadable }
  }

  try {
    // Android hands back a content:// uri that RNFS cannot read directly, so
    // copy into app storage first; on iOS this is a cheap local copy.
    const [copy] = await keepLocalCopy({
      files: [{ uri, fileName: name ?? FALLBACK_FILE_NAME }],
      destination: "cachesDirectory",
    })
    if (copy.status !== "success") return { status: BundleFilePickStatus.Unreadable }

    const content = await RNFS.readFile(copy.localUri, "utf8")
    // The copy is a plaintext-adjacent artifact in the cache; the bundle is
    // already encrypted, but there is no reason to leave a second copy behind.
    await RNFS.unlink(copy.localUri).catch(() => {})
    return { status: BundleFilePickStatus.Picked, content }
  } catch {
    return { status: BundleFilePickStatus.Unreadable }
  }
}
