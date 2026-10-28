import RNFS from "react-native-fs"

import { SDK_LOG_ROTATE_BYTES, sdkLogDir, sdkLogExportDir } from "../config"
import { recordErrorOnce } from "../logging"

/** The name the SDK's file sink appends to inside the directory passed to initLogging. */
export const SDK_LOG_FILE = "sdk.log"
export const SDK_LOG_FILE_PREVIOUS = "sdk.log.1"

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err))

/**
 * The SDK holds `sdk.log` open for the whole process, so launch (before initLogging) is
 * the only moment it can be moved aside. Unlink the previous generation first: RNFS
 * moveFile does not overwrite on iOS.
 */
const rotateIfOversized = async (dir: string): Promise<void> => {
  const current = `${dir}/${SDK_LOG_FILE}`
  const previous = `${dir}/${SDK_LOG_FILE_PREVIOUS}`
  if (!(await RNFS.exists(current))) return
  const { size } = await RNFS.stat(current)
  if (size <= SDK_LOG_ROTATE_BYTES) return

  try {
    if (await RNFS.exists(previous)) await RNFS.unlink(previous)
    await RNFS.moveFile(current, previous)
  } catch (err) {
    /** A rotation that keeps failing must not let the file grow without bound; losing
     *  this file is the lesser cost. Nothing has it open yet, so unlinking is safe. */
    recordErrorOnce("sdk-log-rotate", toError(err), { expected: true })
    await RNFS.unlink(current)
  }
}

/**
 * Creates the log directory and rotates an oversized log. Resolves undefined when the
 * directory is unusable, so SDK startup falls back to logging without a file instead of
 * failing; it never rejects.
 */
export const prepareSdkLogDir = async (): Promise<string | undefined> => {
  const dir = sdkLogDir()
  try {
    await RNFS.mkdir(dir)
  } catch (err) {
    recordErrorOnce("sdk-log-mkdir", toError(err), { expected: true })
    return undefined
  }
  try {
    await rotateIfOversized(dir)
  } catch (err) {
    recordErrorOnce("sdk-log-rotate", toError(err), { expected: true })
  }
  return dir
}

/**
 * Removes the logs, and any export built from them, with the last wallet: they hold its
 * payment history. A logger already running in this process keeps writing to the
 * unlinked file until the next launch.
 */
export const deleteSdkLogs = async (): Promise<void> => {
  for (const dir of [sdkLogDir(), sdkLogExportDir()]) {
    try {
      if (await RNFS.exists(dir)) await RNFS.unlink(dir)
    } catch (err) {
      recordErrorOnce("sdk-log-delete", toError(err), { expected: true })
    }
  }
}
