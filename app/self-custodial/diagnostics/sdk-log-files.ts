import { initLogging } from "@breeztech/breez-sdk-spark-react-native"
import RNFS from "react-native-fs"

import { SDK_LOG_ROTATE_BYTES, sdkLogDir, sdkLogExportDir } from "../config"
import { createSdkLogListener, recordErrorOnce } from "../logging"

/**
 * The one owner of the SDK log's lifecycle: starting the logger, rotating and purging its
 * file, deleting it with the last wallet, and telling the export where the deleted part
 * ends. The SDK installs its logger once per process and holds `sdk.log` open until the
 * process exits, with no way to close or reopen it, so these steps have to agree.
 */

/** The name the SDK's file sink appends to inside the directory passed to initLogging. */
export const SDK_LOG_FILE = "sdk.log"
export const SDK_LOG_FILE_PREVIOUS = "sdk.log.1"
/** Written when the last wallet is deleted while the logger holds `sdk.log` open: the
 *  byte offset where the deleted wallet's lines end. The next launch removes the logs. */
export const SDK_LOG_PURGE_MARKER = "sdk.log.purge"

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err))

const pathsIn = (dir: string) => ({
  current: `${dir}/${SDK_LOG_FILE}`,
  previous: `${dir}/${SDK_LOG_FILE_PREVIOUS}`,
  marker: `${dir}/${SDK_LOG_PURGE_MARKER}`,
})

const unlinkIfExists = async (path: string): Promise<void> => {
  if (await RNFS.exists(path)) await RNFS.unlink(path)
}

/** Set once initLogging has opened `sdk.log`; deleting it after that has to be deferred. */
let isLogFileOpen = false
/** Bytes of `sdk.log` written before the last wallet was deleted in this process. */
let deletedThroughByte: number | undefined

/** A marker's offset; an unreadable one deletes the whole file rather than keep any of it. */
const parseMarker = (text: string): number => {
  const offset = Number.parseInt(text, 10)
  return Number.isFinite(offset) && offset >= 0 ? offset : Number.POSITIVE_INFINITY
}

/**
 * Finishes a deletion deferred from the previous process, before initLogging opens the
 * file again. What a wallet created after the deletion wrote past the cut is kept: a
 * user told to delete and restore their wallet still has that session's lines. The marker
 * goes before the kept lines are written back, so a crash part-way can lose them but can
 * never apply the cut to the new file or leave the deleted lines behind.
 */
const purgeDeletedLogs = async (dir: string): Promise<void> => {
  const { current, previous, marker } = pathsIn(dir)
  if (!(await RNFS.exists(marker))) return
  const deletedThrough = parseMarker(await RNFS.readFile(marker, "utf8"))
  const size = (await RNFS.exists(current)) ? (await RNFS.stat(current)).size : 0
  const kept =
    size > deletedThrough
      ? await RNFS.read(current, size - deletedThrough, deletedThrough, "base64")
      : ""

  await unlinkIfExists(previous)
  await unlinkIfExists(current)
  await RNFS.unlink(marker)
  if (kept) await RNFS.writeFile(current, kept, "base64")
}

/**
 * Launch, before initLogging, is the only moment `sdk.log` can be moved aside. Unlink the
 * previous generation first: RNFS moveFile does not overwrite on iOS.
 */
const rotateIfOversized = async (dir: string): Promise<void> => {
  const { current, previous } = pathsIn(dir)
  if (!(await RNFS.exists(current))) return
  const { size } = await RNFS.stat(current)
  if (size <= SDK_LOG_ROTATE_BYTES) return

  try {
    await unlinkIfExists(previous)
    await RNFS.moveFile(current, previous)
  } catch (err) {
    /** A rotation that keeps failing must not let the file grow without bound; losing
     *  this file is the lesser cost. Nothing has it open yet, so unlinking is safe. */
    recordErrorOnce("sdk-log-rotate", toError(err), { expected: true })
    await RNFS.unlink(current)
  }
}

/**
 * Creates the log directory, finishes a deletion deferred from the last process, and
 * rotates an oversized log. Resolves undefined when the directory is unusable, or when
 * deleted logs could not be removed, so the logger runs without a file rather than
 * appending to them; it never rejects.
 */
const prepareSdkLogDir = async (): Promise<string | undefined> => {
  const dir = sdkLogDir()
  try {
    await RNFS.mkdir(dir)
  } catch (err) {
    recordErrorOnce("sdk-log-mkdir", toError(err), { expected: true })
    return undefined
  }
  try {
    await purgeDeletedLogs(dir)
  } catch (err) {
    recordErrorOnce("sdk-log-purge", toError(err), { expected: true })
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
 * A file that cannot be opened makes initLogging fail before it installs anything, the
 * listener included, so it is retried without one: losing the file must not also lose
 * the Crashlytics breadcrumbs.
 */
const startLogging = async (): Promise<void> => {
  // prepareSdkLogDir does not reject; the catch keeps a future change from failing connects
  const logDir = await prepareSdkLogDir().catch(() => undefined)
  try {
    initLogging(logDir, createSdkLogListener(), undefined)
    isLogFileOpen = logDir !== undefined
  } catch (err) {
    // initLogging can fail if called after SDK state changes; non-fatal
    if (logDir === undefined) return
    try {
      initLogging(undefined, createSdkLogListener(), undefined)
      recordErrorOnce("sdk-log-file-init", toError(err))
    } catch {
      // the retry failing too means the file was never the problem; non-fatal
    }
  }
}

/** Holds the promise rather than a flag: two connects racing (an account switch) must
 *  share one initLogging call, and the flag would only be set after the first await. */
let loggingStarted: Promise<void> | undefined

/** Starts the SDK logger once per process, writing to `sdk.log` when it can. */
export const startSdkLogger = (): Promise<void> => {
  if (!loggingStarted) loggingStarted = startLogging()
  return loggingStarted
}

/**
 * Removes the logs, and any export built from them, with the last wallet: they hold its
 * payment history. While the logger holds `sdk.log` open it cannot be removed without
 * losing every line a new wallet in this process writes, so it is cut off instead: the
 * export never reads before the cut, and the next launch removes the file.
 */
export const deleteSdkLogs = async (): Promise<void> => {
  const dir = sdkLogDir()
  const { current, previous, marker } = pathsIn(dir)
  try {
    await unlinkIfExists(sdkLogExportDir())
    if (!isLogFileOpen) {
      await unlinkIfExists(dir)
      return
    }
    deletedThroughByte = (await RNFS.exists(current))
      ? (await RNFS.stat(current)).size
      : 0
    await RNFS.writeFile(marker, String(deletedThroughByte), "utf8")
    await unlinkIfExists(previous)
  } catch (err) {
    recordErrorOnce("sdk-log-delete", toError(err), { expected: true })
    /** Without a marker the next launch would keep the deleted lines; remove them now,
     *  at the cost of this process's later lines until a restart. */
    await unlinkIfExists(dir).catch(() => undefined)
  }
}

/**
 * Where an export of `sdk.log` must start: past every line written before the last
 * wallet was deleted, in this process or one whose deferred removal has not run yet.
 * Undefined when nothing was deleted. An unreadable marker cuts the whole file, and a
 * marker that can't be read at all rejects, so an export never includes deleted lines.
 */
export const readSdkLogDeletedThroughByte = async (): Promise<number | undefined> => {
  if (deletedThroughByte !== undefined) return deletedThroughByte
  const { marker } = pathsIn(sdkLogDir())
  if (!(await RNFS.exists(marker))) return undefined
  return parseMarker(await RNFS.readFile(marker, "utf8"))
}
