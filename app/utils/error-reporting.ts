import crashlytics from "@react-native-firebase/crashlytics"

/**
 * The single Crashlytics recording boundary (issue #3928).
 *
 * Every non-fatal in the app must flow through `recordAppError` (directly or via
 * `reportError` / `logError` / `recordErrorOnce`) so expected device/user states and
 * connectivity blips become breadcrumbs instead of non-fatal noise. This module must
 * stay the only caller of `crashlytics().recordError`.
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

const isCrashReportingOpen = (): boolean =>
  crashReportingOpen ?? crashlytics().isCrashlyticsCollectionEnabled !== false

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
  crashlytics().recordError(error)
}
