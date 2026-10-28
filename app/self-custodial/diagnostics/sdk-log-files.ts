import { initLogging } from "@breeztech/breez-sdk-spark-react-native"
import RNFS from "react-native-fs"

import { SDK_LOG_ROTATE_BYTES, sdkLogDir, sdkLogExportDir } from "../config"
import { createSdkLogListener, recordErrorOnce } from "../logging"

/**
 * The one owner of the SDK log's lifecycle. The SDK installs its logger once per process
 * and holds `sdk.log` open until the process exits, with no way to close or reopen it,
 * and its lines don't say which wallet wrote them. So deleting any wallet resets the
 * whole log, in steps that hold wherever the process stops:
 * 1. a reset flag is written before the wallet itself is deleted;
 * 2. for the rest of the process, exports read only what `sdk.log` gains after that;
 * 3. the next launch removes the logs, and then the flag, before the logger opens the
 *    file, whether or not a wallet ever connects again.
 */

/** The name the SDK's file sink appends to inside the directory passed to initLogging. */
export const SDK_LOG_FILE = "sdk.log"
export const SDK_LOG_FILE_PREVIOUS = "sdk.log.1"
/** Present while a reset is pending. Only its existence counts, so a write torn by a
 *  crash can't make it keep anything. */
export const SDK_LOG_RESET_FLAG = "sdk.log.reset"

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err))

const pathsIn = (dir: string) => ({
  current: `${dir}/${SDK_LOG_FILE}`,
  previous: `${dir}/${SDK_LOG_FILE_PREVIOUS}`,
  flag: `${dir}/${SDK_LOG_RESET_FLAG}`,
})

const unlinkIfExists = async (path: string): Promise<void> => {
  if (await RNFS.exists(path)) await RNFS.unlink(path)
}

/** Set once initLogging has opened `sdk.log`; it can't be removed in this process after. */
let isLogFileOpen = false
/** Where the last reset in this process cut `sdk.log` off; exports read past it. */
let resetAtByte: number | undefined

/** Removes the logs, then the flag: a stop part-way leaves the flag for the next try. */
const finishReset = async (dir: string): Promise<void> => {
  const { current, previous, flag } = pathsIn(dir)
  if (!(await RNFS.exists(flag))) return
  await unlinkIfExists(sdkLogExportDir())
  await unlinkIfExists(current)
  await unlinkIfExists(previous)
  await RNFS.unlink(flag)
}

let launchReset: Promise<void> | undefined

/**
 * Finishes a reset an earlier process left pending, once per launch. Called from app start
 * so it runs even if no wallet connects again, and awaited before the logger starts so
 * it never removes a file the logger holds. Never rejects.
 */
export const finishPendingSdkLogReset = (): Promise<void> => {
  if (!launchReset) {
    launchReset = finishReset(sdkLogDir()).catch((err) =>
      recordErrorOnce("sdk-log-reset", toError(err), { expected: true }),
    )
  }
  return launchReset
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
 * Creates the log directory and rotates an oversized log. Resolves undefined when the
 * directory is unusable, or while a reset is still pending, so the logger runs without a
 * file rather than append to logs that are due for removal; it never rejects.
 */
const prepareSdkLogDir = async (): Promise<string | undefined> => {
  const dir = sdkLogDir()
  try {
    await RNFS.mkdir(dir)
    if (await RNFS.exists(pathsIn(dir).flag)) return undefined
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
 * A file that cannot be opened makes initLogging fail before it installs anything, the
 * listener included, so it is retried without one: losing the file must not also lose
 * the Crashlytics breadcrumbs.
 */
const startLogging = async (): Promise<void> => {
  // neither rejects; the catches keep a future change from failing connects
  await finishPendingSdkLogReset().catch(() => undefined)
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
 * Resets the logs when any self-custodial wallet is deleted: they hold its payment
 * history, mixed with every other wallet's. Call it before the wallet itself is removed,
 * so a stop in between still leaves the reset to finish at the next launch. Never rejects.
 */
export const resetSdkLogs = async (): Promise<void> => {
  // a logger part-way through starting could otherwise open a file this then removes
  if (loggingStarted) await loggingStarted
  const dir = sdkLogDir()
  const { current, previous } = pathsIn(dir)

  try {
    await RNFS.mkdir(dir)
    await RNFS.writeFile(pathsIn(dir).flag, "", "utf8")
  } catch (err) {
    recordErrorOnce("sdk-log-reset-flag", toError(err), { expected: true })
    /** With no flag on disk the next launch can't finish the reset, so remove the logs
     *  now; a running logger then writes where no export reads until the next launch. */
    for (const path of [sdkLogExportDir(), current, previous]) {
      await unlinkIfExists(path).catch(() => undefined)
    }
    return
  }

  if (!isLogFileOpen) {
    await finishReset(dir).catch((err) =>
      recordErrorOnce("sdk-log-reset", toError(err), { expected: true }),
    )
    return
  }

  /** The logger holds `sdk.log`: keep it, cut it off here, and leave it to the next
   *  launch. The other files are no longer read, so failing to remove them is recorded
   *  and left to that launch too. */
  resetAtByte = await RNFS.stat(current)
    .then(({ size }) => size)
    .catch(() => Number.POSITIVE_INFINITY)
  for (const path of [previous, sdkLogExportDir()]) {
    await unlinkIfExists(path).catch((err) =>
      recordErrorOnce("sdk-log-reset", toError(err), { expected: true }),
    )
  }
}

/**
 * Where an export of `sdk.log` must start, and whether `sdk.log.1` is off limits:
 * undefined when no reset is pending, the cut when one happened in this process, and
 * infinity, so nothing is read, when an earlier process's reset hasn't finished yet.
 */
export const readSdkLogResetByte = async (): Promise<number | undefined> => {
  if (resetAtByte !== undefined) return resetAtByte
  return (await RNFS.exists(pathsIn(sdkLogDir()).flag))
    ? Number.POSITIVE_INFINITY
    : undefined
}
