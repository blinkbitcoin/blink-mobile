import analytics from "@react-native-firebase/analytics"

import { reportError } from "@app/utils/error-logging"

/**
 * The collection gate. Analytics is off until the wallet's mode is positively resolved as
 * custodial or Enhanced; every other state — unknown, unsynchronised, timed out, offline,
 * failed recovery — means off (FR-3, FR-6, §5.7). Failure never falls back to enabled.
 *
 * The gate is deliberately global rather than scoped to the measurement pipeline. Firebase
 * collects automatic and screen-level events on its own, and the app still holds direct
 * `logEvent` call sites; toggling collection is what makes all of them silent in incognito
 * (FR-20, CD-3) without depending on every call site having been migrated first.
 */

export const TelemetryMode = {
  /** No mode has been established. The startup state, and the state any failure returns to. */
  Unresolved: "unresolved",
  Custodial: "custodial",
  Enhanced: "enhanced",
  Incognito: "incognito",
} as const

export type TelemetryMode = (typeof TelemetryMode)[keyof typeof TelemetryMode]

/** Only these two consent to measurement. Incognito never does, permanently (§5.1). */
const COLLECTING_MODES: readonly TelemetryMode[] = [
  TelemetryMode.Custodial,
  TelemetryMode.Enhanced,
]

let currentMode: TelemetryMode = TelemetryMode.Unresolved

/**
 * Listeners run when the gate closes, so anything holding un-sent events can drop them.
 * Registered rather than called directly because the outbox (FR-21) is blocked on OD-1 and
 * does not exist yet: this is the seam it plugs into, and the discard-never-flush ordering
 * (FR-4, FR-5) is the gate's to enforce, not the outbox's to remember.
 */
type SuppressionListener = () => void
const suppressionListeners = new Set<SuppressionListener>()

export const onTelemetrySuppressed = (listener: SuppressionListener): (() => void) => {
  suppressionListeners.add(listener)
  return () => {
    suppressionListeners.delete(listener)
  }
}

const notifySuppressed = (): void => {
  for (const listener of suppressionListeners) {
    try {
      listener()
    } catch (err) {
      reportError("telemetry suppression listener", err)
    }
  }
}

const applyCollectionEnabled = (enabled: boolean): void => {
  analytics()
    .setAnalyticsCollectionEnabled(enabled)
    .catch((err) => {
      reportError("analytics collection toggle", err)
    })
}

/**
 * Forces the gate shut. Called once as early in bootstrap as possible, because
 * `setAnalyticsCollectionEnabled` persists across launches: a device that was Enhanced
 * last run starts the next one collecting, and the window before mode resolves is exactly
 * when a user who has since switched to incognito would leak.
 */
export const initializeTelemetryGate = (): void => {
  currentMode = TelemetryMode.Unresolved
  applyCollectionEnabled(false)
}

/**
 * Records the mode the app has positively established and opens or closes the gate to
 * match. Re-resolving the same mode is a no-op, so this is safe to call from an effect
 * that re-runs on unrelated renders.
 */
export const resolveTelemetryMode = (mode: TelemetryMode): void => {
  if (mode === currentMode) return

  const wasCollecting = COLLECTING_MODES.includes(currentMode)
  currentMode = mode
  const isCollecting = COLLECTING_MODES.includes(mode)

  if (isCollecting) {
    applyCollectionEnabled(true)
    return
  }

  /**
   * Discard first, then disable. The order matters and is the whole of FR-4 and FR-5:
   * flushing what is queued before closing the gate would upload exactly the events the
   * switch was meant to withhold.
   */
  if (wasCollecting) notifySuppressed()
  applyCollectionEnabled(false)
}

export const getTelemetryMode = (): TelemetryMode => currentMode

/** Whether any analytics may be collected at all. */
export const isCollectionPermitted = (): boolean => COLLECTING_MODES.includes(currentMode)

/**
 * Whether *self-custodial* telemetry may be emitted. Narrower than
 * `isCollectionPermitted`: a custodial session collects analytics but must never produce
 * Spark-tagged events, and mislabelling is a correctness defect of the same severity as a
 * leak (FR-19).
 */
export const isSelfCustodialTelemetryPermitted = (): boolean =>
  currentMode === TelemetryMode.Enhanced

/** Test seam. Production code drives the gate through `resolveTelemetryMode`. */
export const resetTelemetryGateForTesting = (): void => {
  currentMode = TelemetryMode.Unresolved
  suppressionListeners.clear()
}
