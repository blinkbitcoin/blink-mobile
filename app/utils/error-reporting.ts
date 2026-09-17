import { NativeModules } from "react-native"

import crashlytics from "@react-native-firebase/crashlytics"

import {
  DiagnosticsDisposition,
  getDiagnosticsDisposition,
  onDiagnosticsDispositionChanged,
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
 * `Anon` or `Unresolved`, or a self-custodial device under the kill switch: a non-fatal
 * or a breadcrumb carries a device-stable Crashlytics installation id, and from such a
 * device that is telemetry whatever product sends it. Gating here rather than at the 119
 * call sites is what makes the rule structural — a call site cannot forget it, and call
 * site 120 inherits it. The ESLint ban on `@react-native-firebase/crashlytics` outside
 * this file and the boundary's diagnostics is what keeps 120 from importing around it.
 *
 * The disposition has three states and the sink treats each differently:
 *
 *  - `unresolved` — the device has not said what it is. An error is *held*, bounded, so
 *    a custodial user's start-up failure still reaches Crashlytics, a few hundred
 *    milliseconds late. Breadcrumbs are not held; they are context for a report, and a
 *    report raised later carries its own.
 *  - `denied` — the device must emit zero. An error is *dropped*, and so is anything
 *    still held from before the answer came: what an incognito wallet raised while
 *    starting is exactly what must not leave it, on this launch or after a later switch.
 *  - `permitted` — transmitted, and the held buffer is released first.
 *
 * Automatic crash collection follows the same disposition — see `applyCrashCollection`.
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
  switch (getDiagnosticsDisposition()) {
    case DiagnosticsDisposition.Permitted:
      transmit(error, options)
      return
    case DiagnosticsDisposition.Unresolved:
      if (__DEV__) console.debug(`[held] ${error.message}`)
      heldWhileUnresolved.push({ error, options })
      if (heldWhileUnresolved.length > HELD_ERRORS_MAX) heldWhileUnresolved.shift()
      return
    case DiagnosticsDisposition.Denied:
      if (__DEV__) console.debug(`[dropped] ${error.message}`)
  }
}

/**
 * On every change of disposition. A device that may now report releases what it held; a
 * device that may not drops it. `denied` clears the buffer even when nothing was ever
 * released: the errors an incognito wallet raised while its mode was still unresolved
 * belong to an incognito wallet, whatever mode it is switched to later.
 */
onDiagnosticsDispositionChanged((disposition) => {
  applyCrashCollection(disposition)
  if (disposition === DiagnosticsDisposition.Unresolved) return
  const held = heldWhileUnresolved
  heldWhileUnresolved = []
  if (disposition === DiagnosticsDisposition.Denied) return
  for (const { error, options } of held) transmit(error, options)
})

/**
 * Automatic crash collection under the same rule as the explicit paths (AD-13, NFR-P1;
 * the third and fourth reviews). A fatal crash report carries the same installation id a
 * non-fatal does, so gating one and not the other would leave the larger channel open.
 *
 * Two SDK facts shape this. React Native Firebase's `setCrashlyticsCollectionEnabled`
 * persists a preference the native init provider applies at the *next* launch and does
 * not change the running process (verified against `@react-native-firebase/crashlytics@
 * 23.3.1`); and Crashlytics records a crash even while collection is off — it only
 * withholds the upload until the next launch. So the switch is native: the
 * `CrashCollection` module (MainApplication.kt / AppDelegate.mm) changes the running
 * process, deletes held reports on a denial, and records the disposition as *provenance*
 * for the next launch, which starts collection only if the previous session ended
 * permitted and deletes what it holds otherwise. The RNFB preference is kept in step so
 * its own gate on `log()` and `recordError()` agrees.
 *
 * `unresolved` writes nothing: it is the start of every launch, and the native side has
 * already set this session to unresolved. A crash before resolution is therefore never
 * uploaded — including on a device whose previous session was permitted — at the cost of
 * a custodial device's start-up crashes before the mode resolves, and of a fresh install's
 * first session. Both are stated residuals of this rule, not of its implementation.
 *
 * Nothing here may throw: a missing native module at start-up is a real failure mode, and
 * the disposition update this rides on must complete regardless.
 */
const applyCrashCollection = (disposition: DiagnosticsDisposition): void => {
  if (disposition === DiagnosticsDisposition.Unresolved) return
  const permitted = disposition === DiagnosticsDisposition.Permitted
  try {
    crashlytics()
      .setCrashlyticsCollectionEnabled(permitted)
      .catch(() => undefined)
  } catch (err) {
    if (__DEV__)
      console.warn("[error-reporting] crash collection preference not written", err)
  }
  try {
    const native = NativeModules.CrashCollection as
      | { setCrashCollectionDisposition: (permitted: boolean) => void }
      | undefined
    native?.setCrashCollectionDisposition(permitted)
  } catch (err) {
    if (__DEV__) console.warn("[error-reporting] crash collection not applied", err)
  }
}

/**
 * A breadcrumb, under the same rule. Code that used to call `crashlytics().log()`
 * directly goes through here so it cannot bypass the gate.
 */
export const logBreadcrumb = (message: string): void => {
  if (getDiagnosticsDisposition() !== DiagnosticsDisposition.Permitted) {
    if (__DEV__) console.debug(`[breadcrumb withheld] ${message}`)
    return
  }
  crashlytics().log(message)
}

/**
 * The developer screen's crash test: a deliberate native crash to prove the pipeline
 * end to end, on a device in hand. Development builds only — in a release build this is
 * a no-op, so the one caller needs no exemption from the import ban.
 */
export const crashForTesting = (): void => {
  if (!__DEV__) return
  crashlytics().log("Testing crash")
  crashlytics().crash()
}

export const resetErrorReportingForTesting = (): void => {
  recordedDedupKeys.clear()
  heldWhileUnresolved = []
}
