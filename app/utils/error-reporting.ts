import crashlytics from "@react-native-firebase/crashlytics"

import { withTimeout } from "./with-timeout"

/**
 * The single Crashlytics recording boundary (issue #3928).
 *
 * Every non-fatal in the app must flow through `recordAppError` (directly or via
 * `reportError` / `logError` / `recordErrorOnce`) so expected device/user states and
 * connectivity blips become breadcrumbs instead of non-fatal noise. This module must
 * stay the only importer of Crashlytics (lint enforces it), so every write passes the
 * closed-domain gate below.
 *
 * Dedup keys follow the `<area>-<what>` convention (e.g. `spark-token-decimals-missing`).
 */

export const ErrorReportClass = {
  Expected: "expected",
  Transient: "transient",
  Defect: "defect",
} as const
export type ErrorReportClass = (typeof ErrorReportClass)[keyof typeof ErrorReportClass]

export const CONNECTIVITY_PATTERNS: readonly RegExp[] = [
  // "unavailable" only in its transport forms — a bare match would swallow
  // storage-layer defects like "AsyncStorage unavailable".
  /code:? ?unavailable|service,? ?(is )?(currently )?unavailable|SERVICE_NOT_AVAILABLE/i,
  /dns error/i,
  /transport error/i,
  /timed? ?out/i,
  /network ?error|network request failed|network down/i,
  /failed to fetch|fetch failed/i,
  /connection (refused|reset|closed|aborted|failed)/i,
  /socket/i,
  /aborted|abort ?error/i,
  /ECONN\w*|ENETUNREACH|EHOSTUNREACH|ETIMEDOUT|ENOTFOUND/,
  /no internet|internet connection appears to be offline/i,
]

export const isConnectivityError = (err: unknown): boolean => {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return CONNECTIVITY_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * What kind of failure, without its text: a breadcrumb that interpolates an error carries
 * whatever the error echoed back, such as the lightning address a contact call was given
 * or a storage path naming the account. Only the class name (when it is a plain
 * identifier) and whether it was connectivity survive.
 */
export const errorKind = (err: unknown): string => {
  if (isConnectivityError(err)) return "connectivity"
  if (err instanceof Error && /^[A-Za-z_]\w{0,39}$/.test(err.name)) return err.name
  return typeof err
}

export const toError = (err: unknown): Error => {
  if (err instanceof Error) return err
  if (typeof err === "string") return new Error(err)
  try {
    return new Error(JSON.stringify(err))
  } catch {
    return new Error(String(err))
  }
}

export type RecordAppErrorOptions = {
  /** Caller-declared expected device/user state → breadcrumb only, never recordError. */
  expected?: boolean
  /** Suppress duplicate recordError for this key for the process lifetime; breadcrumbs still flow. */
  dedupKey?: string
  /** Bypass the connectivity downgrade (crash-adjacent sites); `expected` still wins. */
  alwaysRecord?: boolean
  /** Crashlytics' name for the non-fatal, which groups its reports. */
  jsErrorName?: string
  /** The unredacted text to classify, when the reported message has been scrubbed of
   *  the very words (a quoted server message) that mark it as connectivity. */
  classifyText?: string
}

export const classifyError = (
  error: Error,
  options?: Pick<RecordAppErrorOptions, "expected" | "alwaysRecord" | "classifyText">,
): ErrorReportClass => {
  if (options?.expected) return ErrorReportClass.Expected
  if (options?.alwaysRecord) return ErrorReportClass.Defect
  const subject = options?.classifyText ?? error
  return isConnectivityError(subject)
    ? ErrorReportClass.Transient
    : ErrorReportClass.Defect
}

let crashReportingOpen: boolean | undefined

/**
 * Closed while an Incognito or unset-mode wallet is active: nothing is written to
 * Crashlytics, not even a breadcrumb, since a breadcrumb rides along with the next report
 * made in this process, whichever account is active by then. Set by the analytics
 * identity owner; until it first speaks, the persisted collection switch decides, so a
 * session that ended closed starts closed.
 */
export const setCrashReportingOpen = (open: boolean): void => {
  crashReportingOpen = open
}

/**
 * Shuts the gate at once, then turns collection off. RNFB's switch reaches the native SDK
 * in this process (patches/@react-native-firebase+crashlytics), so a fatal from here on is
 * held on the device rather than sent. A throw comes back as a rejection, so a shutdown
 * can never throw out of its caller.
 */
export const closeCrashReporting = (): Promise<unknown> => {
  setCrashReportingOpen(false)
  return new Promise((resolve) => {
    resolve(crashlytics().setCrashlyticsCollectionEnabled(false))
  })
}

/** How long a reopen waits for the SDK's startup to say whether it found held reports. */
export const HELD_REPORTS_CHECK_TIMEOUT_MS = 5000

let heldAtLaunch: Promise<boolean> | undefined

/**
 * Whether this launch started with reports held on the device. The SDK answers once per
 * process (a second ask is told false), so the first answer is kept. It answers as its
 * startup subscribes to the send-or-delete decision, so a delete issued after it is one
 * that startup obeys.
 */
const wereReportsHeldAtLaunch = (): Promise<boolean> => {
  heldAtLaunch ??= crashlytics().checkForUnsentReports()
  return heldAtLaunch
}

/**
 * Clears the way for collection to come back on, and says whether it may. Reports held
 * while collection was off were made under a closed domain, and turning collection on
 * would send them under the account that opened it. The SDK reports no deletion's
 * completion, and an enable that reaches its startup before the delete does sends them
 * instead (firebase-crashlytics 20.0.1 `waitForReportAction` reads the switch before it
 * listens for a delete). So collection comes back only in a launch whose startup found
 * nothing held: one that did deletes them and stays off, and the next launch's own check
 * is the proof they are gone. No answer in time counts as held.
 */
export const releaseHeldCrashReports = async (): Promise<boolean> => {
  const reporter = crashlytics()
  if (reporter.isCrashlyticsCollectionEnabled) return true
  const held = await withTimeout(
    wereReportsHeldAtLaunch(),
    HELD_REPORTS_CHECK_TIMEOUT_MS,
    "Crashlytics held-report check",
  ).catch(() => true)
  /** Harmless when unsure: with collection kept off, a startup that has yet to look
   *  finds the decision already made. */
  if (held) await reporter.deleteUnsentReports()
  return !held
}

/** Collection on; the gate stays shut until the caller, still current, reopens it. */
export const enableCrashCollection = (): Promise<unknown> =>
  crashlytics().setCrashlyticsCollectionEnabled(true)

const isCrashReportingOpen = (): boolean =>
  crashReportingOpen ?? crashlytics().isCrashlyticsCollectionEnabled !== false

/** The developer screen's crash test. Crashlytics itself drops it while collection is
 *  off, so it never crashes an Incognito session. */
export const crashForTesting = (): void => {
  logBreadcrumb("Testing crash")
  crashlytics().crash()
}

/** A Crashlytics breadcrumb, dropped while crash reporting is closed. */
export const logBreadcrumb = (message: string): void => {
  if (!isCrashReportingOpen()) return
  crashlytics().log(message)
}

const recordedDedupKeys = new Set<string>()

export const recordAppError = (error: Error, options?: RecordAppErrorOptions): void => {
  if (!isCrashReportingOpen()) return
  const errorClass = classifyError(error, options)
  crashlytics().log(`[${errorClass}] ${error.message}`)
  if (errorClass !== ErrorReportClass.Defect) return
  if (options?.dedupKey) {
    if (recordedDedupKeys.has(options.dedupKey)) return
    recordedDedupKeys.add(options.dedupKey)
  }
  if (options?.jsErrorName) crashlytics().recordError(error, options.jsErrorName)
  else crashlytics().recordError(error)
}
