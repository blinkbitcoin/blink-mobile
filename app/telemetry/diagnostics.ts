import crashlytics from "@react-native-firebase/crashlytics"

import { reportError } from "@app/utils/error-logging"

/**
 * Fault reporting for the boundary, and the only place it decides whether a diagnostic may
 * leave the device.
 *
 * AD-13: on an `Anon` or `Unresolved` device the boundary emits **nothing at all** —
 * including diagnostics, health signals and error reports. A crash report naming the
 * telemetry boundary, sent from a device that is required to emit zero, is the leak the
 * suppression exists to prevent, routed around the analytics disable by our own topology.
 *
 * Transmissibility is pushed here by `mode.ts` on every transition rather than pulled from
 * it, which keeps this module free of a cycle and leaves the default at **false**: a
 * failure to resolve a mode leaves diagnostics silent, like everything else.
 */

let transmissible = false

export const setDiagnosticsTransmissible = (next: boolean): void => {
  transmissible = next
}

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
  untransmittedFaults: 0,
}

export const countSuppressedEvent = (): void => {
  counters.suppressedEvents += 1
}

export const countUnroutedEvent = (): void => {
  counters.unroutedEvents += 1
}

export const getDiagnosticCounters = (): Readonly<typeof counters> => ({ ...counters })

export const resetDiagnosticsForTesting = (): void => {
  transmissible = false
  counters.suppressedEvents = 0
  counters.unroutedEvents = 0
  counters.untransmittedFaults = 0
}

/**
 * A breadcrumb, subject to the same rule as everything else here: nothing leaves an `Anon`
 * or `Unresolved` device. On `Custodial` and `Enhanced` the spine permits boundary
 * diagnostics through Crashlytics, which is what makes the FR-68 loss counters reachable
 * from a real device rather than only from a debugger.
 */
export const logDiagnosticBreadcrumb = (message: string): boolean => {
  if (!transmissible) return false
  try {
    crashlytics().log(message)
    return true
  } catch {
    counters.untransmittedFaults += 1
    return false
  }
}

export const reportBoundaryFault = (what: string, err: unknown): void => {
  if (!transmissible) {
    counters.untransmittedFaults += 1
    return
  }
  reportError(`telemetry: ${what}`, err)
}
