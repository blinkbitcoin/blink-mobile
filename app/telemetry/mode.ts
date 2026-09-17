import { contractRowFor, type EmittingMode } from "./contract"
import {
  countSuppressedEvent,
  DiagnosticsModeInput,
  recordModeResolutionLatency,
  reportBoundaryFault,
  setDiagnosticsModeInput,
} from "./diagnostics"
import { isTelemetryEnabled } from "./enablement"
import {
  clearCustodialAnalyticsIdentity,
  setCustodialIdentityPermitted,
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
 * The gate is two-dimensional: **mode × the contract row's `modes` column** (FR-70,
 * AD-24). The axis is deliberately not "boundary-emitted versus platform-automatic" — FR-2
 * puts every call behind the boundary, at which point that distinction collapses. An event
 * with a row is permitted where the row says; everything else is a non-contract event
 * whatever emitted it, permitted on Custodial alone. For the three settlement events the
 * table reads:
 *
 * | mode       | contract events | non-contract events | platform collection |
 * |------------|-----------------|---------------------|---------------------|
 * | Custodial  | permitted       | permitted           | on                  |
 * | Enhanced   | permitted       | suppressed (FR-70)  | off                 |
 * | Anon       | suppressed      | suppressed          | off                 |
 * | Unresolved | suppressed      | suppressed          | off                 |
 *
 * The last column is where AD-9's 2026-09-11 re-amendment and this table part ways: CD-6
 * would have Enhanced collection *on* so contract events could ride Firebase. That needs
 * the SDK to suppress its automatic events while `logEvent()` stays live, and it cannot
 * (Q13 — see `platform-analytics.ts`). So Enhanced contract events go to the outbox and
 * the port, and Enhanced collection stays off. Same table, different transport.
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

export type SelfCustodialModeAnswer = "enhanced" | "anon" | null

export type TelemetryModeInputs = {
  activeAccount: ActiveAccountKind
  /**
   * AD-25's three named inputs, for the active self-custodial account:
   *
   *  - `persistedMode` — what this device holds, chosen on this device or recovered onto
   *    it. After AD-25 it is never a default: a null server answer no longer writes
   *    Enhanced into it.
   *  - `serverMode` — the LNURL server's last answer, as the sync hook recorded it.
   *  - neither — the account has never held a mode anywhere this device can see, or the
   *    hook's request is still in flight.
   */
  persistedMode: SelfCustodialModeAnswer
  serverMode: SelfCustodialModeAnswer
  /** Whether the remote config behind the self-custody rollout was actually fetched. */
  remoteConfigTrusted: boolean
  /** Whether this device holds a self-custodial account at all. */
  hasSelfCustodialAccount: boolean
}

/**
 * Pure, and the whole of the default-deny rule.
 *
 * For a self-custodial account the two mode inputs combine with **deny winning in both
 * directions**. AD-25 states the precedence as *server > persisted > none*; read literally
 * that would resolve Enhanced during the window after a user switches to incognito here
 * and before the push lands, while the server's stale answer still says Enhanced — the
 * exact window a switch is meant to close. So an Anon from either input is Anon; Enhanced
 * needs a positive Enhanced from either and no Anon from the other; and nothing from
 * either — never asked, in flight, or the server holding no mode — is `Unresolved`. The
 * server still overrides a stale persisted Enhanced with Anon, which is the multi-device
 * case the precedence exists for.
 *
 * A **null server answer is Unresolved, never Enhanced.** The settings row reads an unset
 * mode as Enhanced so it has something to display; §5.7 asks for a *positive* resolution,
 * and "we never asked, so we assumed consent" is not one.
 *
 * A custodial account active on an **untrusted** remote config resolves `Unresolved` if
 * the device holds a self-custodial account at all. The rollout flag defaults to `off`,
 * `remoteConfigReady` is set in a `finally` regardless of whether the fetch threw, and
 * `useSelfCustodialRollback` swaps the active account to a custodial fallback on that
 * default — so a failed fetch could otherwise turn full platform collection on for someone
 * who last chose incognito. A device with no self-custodial account has nothing to have
 * been rolled back from, and keeps its existing custodial analytics behaviour.
 */
export const deriveTelemetryMode = ({
  activeAccount,
  persistedMode,
  serverMode,
  remoteConfigTrusted,
  hasSelfCustodialAccount,
}: TelemetryModeInputs): TelemetryMode => {
  if (activeAccount === ActiveAccountKind.SelfCustodial) {
    if (persistedMode === "anon" || serverMode === "anon") return TelemetryMode.Anon
    if (persistedMode === "enhanced" || serverMode === "enhanced") {
      return TelemetryMode.Enhanced
    }
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

/** What the mode alone says about diagnostics; the kill switch has its own say for
 *  `Enhanced`, and the derivation lives in `transmissibility.ts` (AD-13, NFR-O4). */
const diagnosticsInputFor = (mode: TelemetryMode): DiagnosticsModeInput => {
  switch (mode) {
    case TelemetryMode.Custodial:
      return DiagnosticsModeInput.Custodial
    case TelemetryMode.Enhanced:
      return DiagnosticsModeInput.SelfCustodial
    case TelemetryMode.Anon:
      return DiagnosticsModeInput.Denied
    case TelemetryMode.Unresolved:
      return DiagnosticsModeInput.Unresolved
  }
}

let currentMode: TelemetryMode = TelemetryMode.Unresolved

/**
 * Runs when the gate closes so anything holding un-sent events can drop them. The outbox
 * registers here rather than being called directly, because "closed before discarded,
 * and never reopened over a discard" (FR-4, FR-5) is the gate's to enforce and not the
 * outbox's to remember.
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

/**
 * Everything that closes, closes here and now — synchronously, in the same tick the mode
 * moves, ahead of anything queued behind a discard. Leaving `Custodial` for any reason
 * turns platform collection off, withdraws the identity permission and clears the
 * identity the SDK would otherwise merge into its next event. A discard is a directory
 * unlink and can be slow; collection staying on for its duration would let the SDK's
 * automatic events and the FR-2 backlog's direct calls transmit from a device whose mode
 * has already closed (the second review's MEDIUM 2).
 */
const closeSynchronously = (mode: TelemetryMode): void => {
  setDiagnosticsModeInput(diagnosticsInputFor(mode))
  if (mode === TelemetryMode.Custodial) return
  setCustodialIdentityPermitted(false)
  clearCustodialAnalyticsIdentity()
  setPlatformCollectionEnabled(false)
}

/**
 * The queued half: the discard, and the one thing that *opens*. Opening waits its turn
 * behind every discard queued before it (FR-4, FR-5: never flush, and never re-enable
 * over a queue that is still being destroyed), and it happens only if `Custodial` is
 * still the current mode when its turn comes — a `Custodial` resolved and immediately
 * overtaken by `Anon` must not reopen collection on the way through.
 */
const applyMode = async (mode: TelemetryMode): Promise<void> => {
  if (isSuppressedMode(mode)) await notifySuppressed()

  if (mode === TelemetryMode.Custodial && currentMode === TelemetryMode.Custodial) {
    setCustodialIdentityPermitted(true)
    setPlatformCollectionEnabled(true)
  }
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

  /** AD-30: how long the device sat in `Unresolved` after the gate was initialised. */
  if (currentMode === TelemetryMode.Unresolved && initialisedAt !== null) {
    recordModeResolutionLatency(Date.now() - initialisedAt)
    initialisedAt = null
  }

  currentMode = mode
  closeSynchronously(mode)

  applying = applying.then(() => applyMode(mode))
  return applying
}

/**
 * Forces the gate shut, as early in bootstrap as possible.
 * `setAnalyticsCollectionEnabled` persists across launches, so a device that resolved
 * Custodial last run starts this one collecting — and the window before the real mode
 * resolves is exactly when a user who has since switched to incognito would leak.
 */
let initialisedAt: number | null = null

export const initializeTelemetryGate = (): Promise<void> => {
  currentMode = TelemetryMode.Unresolved
  initialisedAt = Date.now()
  closeSynchronously(TelemetryMode.Unresolved)
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
  const permitted = isTelemetryEnabled() && isEventPermittedInMode(event, currentMode)
  if (!permitted) countSuppressedEvent()
  return permitted
}

/**
 * The second axis, read off the contract row's `modes` column (AD-24). A contract event is
 * permitted where its row says so; a non-contract event — anything not in the table,
 * whatever emitted it — is permitted on Custodial alone (FR-70). Neither `Anon` nor
 * `Unresolved` appears in any row, so they permit nothing.
 */
const isEventPermittedInMode = (event: string, mode: TelemetryMode): boolean => {
  const row = contractRowFor(event)
  if (!row) return mode === TelemetryMode.Custodial
  return row.modes.includes(mode as EmittingMode)
}

/** The drain is gated too, not just capture (AD-5). An account can queue events, switch to
 *  incognito while inactive and flush them on next activation — which is flush-then-discard
 *  by the back door, and FR-5 prohibits it outright. */
export const isDrainPermitted = (): boolean =>
  isTelemetryEnabled() && currentMode === TelemetryMode.Enhanced

export const resetTelemetryModeForTesting = (): void => {
  currentMode = TelemetryMode.Unresolved
  initialisedAt = null
  applying = Promise.resolve()
  suppressionListeners.clear()
  setDiagnosticsModeInput(DiagnosticsModeInput.Unresolved)
  setCustodialIdentityPermitted(false)
}
