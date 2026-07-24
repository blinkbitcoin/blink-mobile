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
  /unavailable/i,
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

export const toError = (err: unknown): Error =>
  err instanceof Error
    ? err
    : new Error(typeof err === "string" ? err : JSON.stringify(err))

export type RecordAppErrorOptions = {
  /** Caller-declared expected device/user state → breadcrumb only, never recordError. */
  expected?: boolean
  /** Suppress duplicate recordError for this key for the process lifetime; breadcrumbs still flow. */
  dedupKey?: string
  /** Bypass the connectivity downgrade (crash-adjacent sites); `expected` still wins. */
  alwaysRecord?: boolean
}

export const classifyError = (
  error: Error,
  options?: Pick<RecordAppErrorOptions, "expected" | "alwaysRecord">,
): ErrorReportClass => {
  if (options?.expected) return ErrorReportClass.Expected
  if (options?.alwaysRecord) return ErrorReportClass.Defect
  return isConnectivityError(error) ? ErrorReportClass.Transient : ErrorReportClass.Defect
}

const recordedDedupKeys = new Set<string>()

export const recordAppError = (
  error: Error,
  options?: RecordAppErrorOptions,
): void => {
  const errorClass = classifyError(error, options)
  crashlytics().log(`[${errorClass}] ${error.message}`)
  if (errorClass !== ErrorReportClass.Defect) return
  if (options?.dedupKey) {
    if (recordedDedupKeys.has(options.dedupKey)) return
    recordedDedupKeys.add(options.dedupKey)
  }
  crashlytics().recordError(error)
}
