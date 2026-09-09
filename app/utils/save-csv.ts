// eslint-disable-next-line react-native/split-platform-components
import { PermissionsAndroid, Platform } from "react-native"
import RNFS from "react-native-fs"

import { CSV_BASENAME } from "./share-csv"

const CSV_EXTENSION = "csv"

/** Up to API 28 the public Downloads folder is plain external storage, so writing to it
 *  needs the legacy runtime grant. From API 29 scoped storage owns the folder and the
 *  grant no longer exists to be asked for. */
const LEGACY_STORAGE_MAX_SDK = 28

/** Enough to keep a user who exports repeatedly from colliding, few enough that a broken
 *  filesystem can't spin here. Past it the caller falls back to the share sheet. */
const MAX_FILENAME_ATTEMPTS = 100

const requestLegacyWritePermission = async (): Promise<boolean> => {
  /** Asked only when the version is positively known to need it. An unreadable version
   *  falls through to the write, which fails loudly into the share sheet, rather than
   *  requesting a grant that modern Android auto-denies and losing the download to it. */
  if (!(Number(Platform.Version) <= LEGACY_STORAGE_MAX_SDK)) return true

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  )
  return result === PermissionsAndroid.RESULTS.GRANTED
}

/** Mirrors what a browser does with a repeated download: keep the readable name and
 *  number the copies rather than overwriting the export the user already has. */
const findFreeDownloadPath = async (): Promise<string> => {
  const base = `${RNFS.DownloadDirectoryPath}/${CSV_BASENAME}`

  for (let attempt = 0; attempt < MAX_FILENAME_ATTEMPTS; attempt += 1) {
    const path = attempt === 0 ? base : `${base}-${attempt}`
    const candidate = `${path}.${CSV_EXTENSION}`
    if (!(await RNFS.exists(candidate))) return candidate
  }

  throw new Error("No free filename in the Downloads folder")
}

/**
 * Writes the base64 CSV into the public Downloads folder, the way a browser download
 * lands. Resolves the path written, or null when the user refuses the storage grant.
 * Android only — every other platform saves through the share sheet.
 *
 * Raw-path writes are blocked on API 29 (scoped storage without the legacy opt-in), so
 * that one release rejects and the caller falls back to the share sheet.
 */
export const saveCsvToDownloads = async (csvEncoded: string): Promise<string | null> => {
  if (!(await requestLegacyWritePermission())) return null

  const path = await findFreeDownloadPath()
  await RNFS.writeFile(path, csvEncoded, "base64")
  /** Without the MediaStore scan the file exists on disk but is invisible to the Files
   *  and Downloads apps, which is indistinguishable from a failed download. */
  await RNFS.scanFile(path)

  return path
}
