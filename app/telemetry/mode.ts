import { isContractEvent } from "./contract"
import {
  countSuppressedEvent,
  reportBoundaryFault,
  setDiagnosticsTransmissible,
} from "./diagnostics"
import {
  clearCustodialAnalyticsIdentity,
  setPlatformCollectionEnabled,
} from "./platform-analytics"

/**
 * The derived telemetry mode and the gate it drives (AD-5).
 *
 * The repo's own mode accessor cannot be used for this. `AccountMode` is
 * `{ enhanced, anon }` with **no custodial value**, and `null` means *both* "a custodial
 * account is active" *and* "self-custodial, never chose" — a state `app/types/account.ts`
 * documents as normal and permanent after an interrupted restore. So `!isAnonMode` is true
 * for an account that never answered, and gating on it would invert FR-6, whose whole
 * content is that failure must never fall back to enabled.
 *
 * The gate is two-dimensional: **mode × whether the event is in the contract** (FR-70).
 * The axis is deliberately not "boundary-emitted versus platform-automatic" — FR-2 puts
 * every call behind the boundary, at which point that distinction collapses. The contract
 * enumerates three events; everything else is a non-contract event whatever emitted it.
 *
 * | mode       | contract events | non-contract events |
 * |------------|-----------------|---------------------|
 * | Custodial  | permitted       | permitted           |
 * | Enhanced   | permitted       | suppressed (FR-70)  |
 * | Anon       | suppressed      | suppressed          |
 * | Unresolved | suppressed      | suppressed          |
 */

export const TelemetryMode = {
  Custodial: "custodial",
  Enhanced: "enhanced",
  /** Incognito as the user reads it; the stored account value stays `anon`. */
  Anon: "anon",
  /** The startup state, and the state every failure returns to. */
  Unresolved: "unresolved",
} as const

export type TelemetryMode = (typeof TelemetryMode)[keyof typeof TelemetryMode]

export const ActiveAccountKind = {
  None: "none",
  Custodial: "custodial",
  SelfCustodial: "self-custodial",
} as const

export type ActiveAccountKind = (typeof ActiveAccountKind)[keyof typeof ActiveAccountKind]

export type TelemetryModeInputs = {
  activeAccount: ActiveAccountKind
  /** The active self-custodial account's stored mode. `null` means it never answered. */
  selfCustodialMode: "enhanced" | "anon" | null
  /** Whether the remote config behind the self-custody rollout was actually fetched. */
  remoteConfigTrusted: boolean
  /** Whether this device holds a self-custodial account at all. */
  hasSelfCustodialAccount: boolean
}

/**
 * Pure, and the whole of the default-deny rule.
 *
 * Two cases earn their comments. A self-custodial account with **no stored mode** resolves
 * `Unresolved`, not `Enhanced`: the settings row reads an unset mode as Enhanced so it has
 * something to display, but §5.7 asks for a *positive* resolution and "we never asked, so
 * we assumed consent" is not one. Such an account stays silent until `useAccountModeSync`
 * recovers its real mode from the LNURL server.
 *
 * And a custodial account active on an **untrusted** remote config resolves `Unresolved`
 * if the device holds a self-custodial account at all. The rollout flag defaults to `off`,
 * `remoteConfigReady` is set in a `finally` regardless of whether the fetch threw, and
 * `useSelfCustodialRollback` swaps the active account to a custodial fallback on that
 * default — so a failed fetch could otherwise turn full platform collection on for someone
 * who last chose incognito. A device with no self-custodial account has nothing to have
 * been rolled back from, and keeps its existing custodial analytics behaviour.
 */
export const deriveTelemetryMode = ({
  activeAccount,
  selfCustodialMode,
  remoteConfigTrusted,
  hasSelfCustodialAccount,
}: TelemetryModeInputs): TelemetryMode => {
  if (activeAccount === ActiveAccountKind.SelfCustodial) {
    if (selfCustodialMode === "enhanced") return TelemetryMode.Enhanced
    if (selfCustodialMode === "anon") return TelemetryMode.Anon
    return TelemetryMode.Unresolved
  }

  if (activeAccount === ActiveAccountKind.Custodial) {
    if (remoteConfigTrusted || !hasSelfCustodialAccount) return TelemetryMode.Custodial
    return TelemetryMode.Unresolved
  }

  return TelemetryMode.Unresolved
}

const isSuppressedMode = (mode: TelemetryMode): boolean =>
  mode === TelemetryMode.Anon || mode === TelemetryMode.Unresolved

let currentMode: TelemetryMode = TelemetryMode.Unresolved

/**
 * Runs when the gate closes so anything holding un-sent events can drop them. The outbox
 * registers here rather than being called directly, because the discard-then-disable
 * ordering (FR-4, FR-5) is the gate's to enforce and not the outbox's to remember.
 */
type SuppressionListener = () => void | Promise<void>
const suppressionListeners = new Set<SuppressionListener>()

export const onTelemetrySuppressed = (listener: SuppressionListener): (() => void) => {
  suppressionListeners.add(listener)
  return () => {
    suppressionListeners.delete(listener)
  }
}

const notifySuppressed = async (): Promise<void> => {
  await Promise.all(
    [...suppressionListeners].map(async (listener) => {
      try {
        await listener()
      } catch (err) {
        reportBoundaryFault("suppression listener", err)
      }
    }),
  )
}

/** Transitions are serialised, so two mode changes in quick succession cannot interleave a
 *  discard with the enable that follows the next one. */
let applying: Promise<void> = Promise.resolve()

const applyMode = async (mode: TelemetryMode): Promise<void> => {
  /**
   * Discard first, then disable. The order is the whole of FR-4 and FR-5: flushing what is
   * queued before closing the gate would upload exactly the events the switch withheld.
   */
  if (isSuppressedMode(mode)) await notifySuppressed()

  if (mode !== TelemetryMode.Custodial) clearCustodialAnalyticsIdentity()
  setPlatformCollectionEnabled(mode === TelemetryMode.Custodial)
}

/**
 * Records the mode the app has positively established. Re-resolving the same mode is a
 * no-op, so this is safe to call from an effect that re-runs on unrelated renders.
 *
 * `currentMode` moves synchronously while the side effects are queued: capture must stop
 * the instant the mode changes, not once a directory has finished being unlinked.
 */
export const resolveTelemetryMode = (mode: TelemetryMode): Promise<void> => {
  if (mode === currentMode) return applying

  currentMode = mode
  setDiagnosticsTransmissible(!isSuppressedMode(mode))

  applying = applying.then(() => applyMode(mode))
  return applying
}

/**
 * Forces the gate shut, as early in bootstrap as possible.
 * `setAnalyticsCollectionEnabled` persists across launches, so a device that resolved
 * Custodial last run starts this one collecting — and the window before the real mode
 * resolves is exactly when a user who has since switched to incognito would leak.
 */
export const initializeTelemetryGate = (): Promise<void> => {
  currentMode = TelemetryMode.Unresolved
  setDiagnosticsTransmissible(false)
  applying = applying.then(() => applyMode(TelemetryMode.Unresolved))
  return applying
}

export const getTelemetryMode = (): TelemetryMode => currentMode

/**
 * Settles when every queued transition has finished its side effects.
 *
 * The drain waits on this. `currentMode` moves synchronously but the discard it triggers is
 * a directory unlink, so an Anon → Enhanced switch leaves a window where draining is once
 * again permitted while the previous mode's discard is still running — and a drain reading
 * the queue inside that window would submit exactly the records the switch to incognito
 * withheld. FR-5 by the back door, one turn of the event loop wide.
 */
export const whenModeSettled = (): Promise<void> => applying

/**
 * AD-5's gate. Reads the event **name** against the contract before a payload exists,
 * which is why `TelemetryFact` needs no origin field.
 */
export const isEventPermitted = (event: string): boolean => {
  const permitted = isContractEvent(event)
    ? currentMode === TelemetryMode.Custodial || currentMode === TelemetryMode.Enhanced
    : currentMode === TelemetryMode.Custodial

  if (!permitted) countSuppressedEvent()
  return permitted
}

/** The drain is gated too, not just capture (AD-5). An account can queue events, switch to
 *  incognito while inactive and flush them on next activation — which is flush-then-discard
 *  by the back door, and FR-5 prohibits it outright. */
export const isDrainPermitted = (): boolean => currentMode === TelemetryMode.Enhanced

export const resetTelemetryModeForTesting = (): void => {
  currentMode = TelemetryMode.Unresolved
  applying = Promise.resolve()
  suppressionListeners.clear()
  setDiagnosticsTransmissible(false)
}
