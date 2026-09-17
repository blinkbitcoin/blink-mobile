import crashlytics from "@react-native-firebase/crashlytics"

import { reportError } from "@app/utils/error-logging"

import {
  DiagnosticsModeInput,
  mayTransmitDiagnostics,
  resetTransmissibilityForTesting,
  setDiagnosticsModeInput,
} from "./transmissibility"

/**
 * Fault reporting for the boundary, and the only place it decides whether a diagnostic may
 * leave the device.
 *
 * AD-13: on an `Anon` or `Unresolved` device the boundary emits **nothing at all** —
 * including diagnostics, health signals and error reports. A crash report naming the
 * telemetry boundary, sent from a device that is required to emit zero, is the leak the
 * suppression exists to prevent, routed around the analytics disable by our own topology.
 *
 * The disposition itself lives in `transmissibility.ts`, which imports nothing, so the
 * app-wide Crashlytics sink in `app/utils/error-reporting.ts` can read the same value
 * without a cycle. `mode.ts` and `enablement.ts` push its inputs; the default is
 * **unresolved**, under which nothing is transmitted.
 */

export { DiagnosticsModeInput, mayTransmitDiagnostics, setDiagnosticsModeInput }

/**
 * Counts of everything the boundary declined to do, held locally and never transmitted
 * (FR-7). A non-zero suppressed count is the expected state on an incognito device; a
 * non-zero fault count is a defect to be found in review, not a number to report to a
 * board.
 */
const counters = {
  suppressedEvents: 0,
  /** Permitted, but with no store mounted to file them against. Should be zero; a non-zero
   *  count means an emitter is running outside the account context it belongs to. */
  unroutedEvents: 0,
  /** A fact whose `walletProvider` disagreed with the mode at capture: a settlement callback
   *  that raced an account switch. Dropped rather than re-labelled (AD-20). */
  mislabelledEvents: 0,
  untransmittedFaults: 0,
  /** AD-30's "is it draining?" answers, from the last drain that ran. */
  lastDrainDurationMs: 0,
  lastDrainDepth: 0,
  drainRejected: 0,
  drainRetryable: 0,
  /** Milliseconds from the boundary being initialised to the first resolved mode. */
  modeResolutionLatencyMs: 0,
}

export const countSuppressedEvent = (): void => {
  counters.suppressedEvents += 1
}

export const countUnroutedEvent = (): void => {
  counters.unroutedEvents += 1
}

export const countMislabelledEvent = (): void => {
  counters.mislabelledEvents += 1
}

export const recordDrainStats = (stats: {
  durationMs: number
  depth: number
  rejected: number
  retryable: number
}): void => {
  counters.lastDrainDurationMs = stats.durationMs
  counters.lastDrainDepth = stats.depth
  counters.drainRejected += stats.rejected
  counters.drainRetryable += stats.retryable
}

export const recordModeResolutionLatency = (ms: number): void => {
  counters.modeResolutionLatencyMs = ms
}

export const getDiagnosticCounters = (): Readonly<typeof counters> => ({ ...counters })

export const resetDiagnosticsForTesting = (): void => {
  resetTransmissibilityForTesting()
  for (const key of Object.keys(counters) as (keyof typeof counters)[]) {
    counters[key] = 0
  }
}

/**
 * A breadcrumb, subject to the same rule as everything else here: nothing leaves an `Anon`
 * or `Unresolved` device. On `Custodial` and `Enhanced` the spine permits boundary
 * diagnostics through Crashlytics, which is what makes the FR-68 loss counters reachable
 * from a real device rather than only from a debugger.
 */
export const logDiagnosticBreadcrumb = (message: string): boolean => {
  if (!mayTransmitDiagnostics()) return false
  try {
    crashlytics().log(message)
    return true
  } catch {
    counters.untransmittedFaults += 1
    return false
  }
}

export const reportBoundaryFault = (what: string, err: unknown): void => {
  if (!mayTransmitDiagnostics()) {
    counters.untransmittedFaults += 1
    return
  }
  reportError(`telemetry: ${what}`, err)
}
