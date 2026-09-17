import crashlytics from "@react-native-firebase/crashlytics"

import {
  mayTransmitDiagnostics,
  onTransmissibilityChanged,
} from "@app/telemetry/transmissibility"

/**
 * The single Crashlytics recording boundary (issue #3928).
 *
 * Every non-fatal in the app must flow through `recordAppError` (directly or via
 * `reportError` / `logError` / `recordErrorOnce`) so expected device/user states and
 * connectivity blips become breadcrumbs instead of non-fatal noise. This module must
 * stay the only caller of `crashlytics().recordError`.
 *
 * It is also where the privacy contract's zero-transmission rule is applied to error
 * reporting (AD-13, AD-30, NFR-P1). Nothing leaves a device whose telemetry mode is
 * `Anon` or `Unresolved`: a non-fatal or a breadcrumb carries a device-stable Crashlytics
 * installation id, and from an incognito device that is telemetry whatever product sends
 * it. Gating here rather than at the 119 call sites is what makes the rule structural —
 * a call site cannot forget it, and call site 120 inherits it.
 *
 * What is held back is not thrown away blindly. Errors raised before the mode resolves
 * are buffered, and released the moment the device turns out to be one that may report
 * — so a custodial user's start-up failures still reach Crashlytics, a few hundred
 * milliseconds late. A device that resolves incognito drops the buffer unsent.
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

/** Errors raised while the mode was still unresolved, waiting on a device that may report.
 *  Bounded: a device that never resolves must not grow this forever. */
const HELD_ERRORS_MAX = 20
type HeldError = { error: Error; options?: RecordAppErrorOptions }
let heldWhileUnresolved: HeldError[] = []

const transmit = (error: Error, options?: RecordAppErrorOptions): void => {
  const errorClass = classifyError(error, options)
  crashlytics().log(`[${errorClass}] ${error.message}`)
  if (errorClass !== ErrorReportClass.Defect) return
  if (options?.dedupKey) {
    if (recordedDedupKeys.has(options.dedupKey)) return
    recordedDedupKeys.add(options.dedupKey)
  }
  crashlytics().recordError(error)
}

export const recordAppError = (error: Error, options?: RecordAppErrorOptions): void => {
  if (!mayTransmitDiagnostics()) {
    if (__DEV__) console.debug(`[held] ${error.message}`)
    heldWhileUnresolved.push({ error, options })
    if (heldWhileUnresolved.length > HELD_ERRORS_MAX) heldWhileUnresolved.shift()
    return
  }
  transmit(error, options)
}

/**
 * On every mode transition. A device that may now report releases what it held; a device
 * that may not drops it — the errors an incognito wallet raised while starting are exactly
 * what must not leave it.
 */
onTransmissibilityChanged((transmissible) => {
  const held = heldWhileUnresolved
  heldWhileUnresolved = []
  if (!transmissible) return
  for (const { error, options } of held) transmit(error, options)
})

/**
 * A breadcrumb, under the same rule. Self-custodial code that used to call
 * `crashlytics().log()` directly goes through here so it cannot bypass the gate.
 */
export const logBreadcrumb = (message: string): void => {
  if (!mayTransmitDiagnostics()) {
    if (__DEV__) console.debug(`[held-breadcrumb] ${message}`)
    return
  }
  crashlytics().log(message)
}

export const resetErrorReportingForTesting = (): void => {
  recordedDedupKeys.clear()
  heldWhileUnresolved = []
}
