/**
 * The two switches that sit in front of the mode gate (AD-28, AD-30). Both default to
 * *off*, and the boundary emits nothing until the first turns it on.
 *
 * **Rollout flag** — P2 ships behind it, off by default, ramped internal → 5% → 25% → 100%
 * with the gates AD-30 states. It rides Remote Config, which is acceptable *here* because
 * its failure mode is closed: a failed or absent fetch leaves the shipped default, and the
 * shipped default is off. That is the opposite of the `nonCustodialEnabled` fail-open AD-9
 * closed, where a default read as an answer turned collection *on*.
 *
 * **Kill switch** — one-directional: it can only turn telemetry off, and once engaged it
 * stays engaged across launches. It must not share Remote Config's failure mode, so it
 * rides a Blink-controlled channel Enhanced devices already fetch independently — the
 * LNURL server — and the engaged state is persisted so an absent or failed fetch leaves
 * the last value rather than resetting it. The channel's field is backend-owned and not
 * yet served; `applyServerKillSwitch` is where it lands when it is.
 *
 * Rollback under NFR-O4 *is* the kill switch: collection stops, nothing else happens.
 * Queued records are not discarded — that is FR-5's job for a mode switch — they simply
 * stop draining and expire on their own schedule, counted like any other expiry.
 */

let rolloutEnabled = false
let killSwitchEngaged = false

type KillSwitchListener = () => void
const killSwitchListeners = new Set<KillSwitchListener>()

/** Fires once when the switch engages, so the provider can persist it (AD-28). */
export const onKillSwitchEngaged = (listener: KillSwitchListener): (() => void) => {
  killSwitchListeners.add(listener)
  return () => {
    killSwitchListeners.delete(listener)
  }
}

export const setTelemetryRolloutEnabled = (enabled: boolean): void => {
  rolloutEnabled = enabled
}

/** Restores the persisted engaged state on launch. Never disengages. */
export const restoreKillSwitch = (engaged: boolean): void => {
  killSwitchEngaged = killSwitchEngaged || engaged
}

/** Applies what the server said. `true` means "keep going", which changes nothing —
 *  the switch is one-directional. Returns whether the switch is now engaged so the
 *  caller can persist it. */
export const applyServerKillSwitch = (telemetryEnabled: boolean): boolean => {
  if (!telemetryEnabled && !killSwitchEngaged) {
    killSwitchEngaged = true
    for (const listener of killSwitchListeners) listener()
  }
  return killSwitchEngaged
}

export const isKillSwitchEngaged = (): boolean => killSwitchEngaged

export const isTelemetryEnabled = (): boolean => rolloutEnabled && !killSwitchEngaged

export const resetEnablementForTesting = (): void => {
  rolloutEnabled = false
  killSwitchEngaged = false
  killSwitchListeners.clear()
}
