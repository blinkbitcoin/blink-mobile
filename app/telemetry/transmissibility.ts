/**
 * Whether anything at all may leave this device right now (AD-13, AD-30, NFR-O4).
 *
 * One derivation, no imports, so both ends of the app can read it without a cycle: the
 * boundary's own diagnostics on one side, and the app-wide Crashlytics sink in
 * `app/utils/error-reporting.ts` on the other. `mode.ts` pushes the mode's answer on
 * every transition and `enablement.ts` pushes the kill switch's; the disposition is
 * derived here from the two, so there is exactly one place that says what a device may
 * send and no caller combines the inputs itself.
 *
 * Three states, not two, because "may not transmit" means two different things and the
 * sink must treat them differently (the second review's HIGH 2):
 *
 *  - `unresolved` — the device has not yet said which kind it is. An error raised now
 *    may belong to a custodial user whose start-up failure ought to reach Crashlytics, so
 *    the sink *holds* it, bounded, until the answer arrives.
 *  - `denied` — the device is one that must emit zero: `Anon`, or a self-custodial
 *    device under the kill switch. What is raised now is *dropped*, and so is anything
 *    still held: a later switch to Enhanced must not carry incognito-era errors out.
 *  - `permitted` — `Custodial`, or `Enhanced` with the kill switch disengaged.
 *
 * The default is `unresolved`, so a failure to resolve a mode leaves every diagnostic
 * silent, like everything else.
 */

export const DiagnosticsDisposition = {
  Unresolved: "unresolved",
  Denied: "denied",
  Permitted: "permitted",
} as const

export type DiagnosticsDisposition =
  (typeof DiagnosticsDisposition)[keyof typeof DiagnosticsDisposition]

/**
 * What the resolved mode says on its own. `SelfCustodial` is `Enhanced`: permitted by
 * mode, but subject to the switch below. `Custodial` is not — the switch is NFR-O4's
 * rollback of *self-custodial* collection, and custodial crash reporting predates it.
 */
export const DiagnosticsModeInput = {
  Unresolved: "unresolved",
  Denied: "denied",
  Custodial: "custodial",
  SelfCustodial: "self-custodial",
} as const

export type DiagnosticsModeInput =
  (typeof DiagnosticsModeInput)[keyof typeof DiagnosticsModeInput]

let modeInput: DiagnosticsModeInput = DiagnosticsModeInput.Unresolved
/** AD-28: engaged means every self-custodial transmission stops, diagnostics included. */
let selfCustodialShutdown = false

let disposition: DiagnosticsDisposition = DiagnosticsDisposition.Unresolved

type Listener = (disposition: DiagnosticsDisposition) => void
const listeners = new Set<Listener>()

/** The sink subscribes so it can release what it held once a device may report, or drop
 *  it once the device turns out to be one that may not. */
export const onDiagnosticsDispositionChanged = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const derive = (): DiagnosticsDisposition => {
  switch (modeInput) {
    case DiagnosticsModeInput.Unresolved:
      return DiagnosticsDisposition.Unresolved
    case DiagnosticsModeInput.Denied:
      return DiagnosticsDisposition.Denied
    case DiagnosticsModeInput.Custodial:
      return DiagnosticsDisposition.Permitted
    case DiagnosticsModeInput.SelfCustodial:
      return selfCustodialShutdown
        ? DiagnosticsDisposition.Denied
        : DiagnosticsDisposition.Permitted
  }
}

const recompute = (): void => {
  const next = derive()
  if (next === disposition) return
  disposition = next
  for (const listener of listeners) listener(next)
}

export const setDiagnosticsModeInput = (input: DiagnosticsModeInput): void => {
  modeInput = input
  recompute()
}

export const setSelfCustodialDiagnosticsShutdown = (engaged: boolean): void => {
  selfCustodialShutdown = engaged
  recompute()
}

export const getDiagnosticsDisposition = (): DiagnosticsDisposition => disposition

export const mayTransmitDiagnostics = (): boolean =>
  disposition === DiagnosticsDisposition.Permitted

/** Back to the start-up state. Listeners are module-load registrations — the sink's,
 *  chiefly — and survive, so a test that resets and then transitions still exercises
 *  the release and the drop. */
export const resetTransmissibilityForTesting = (): void => {
  modeInput = DiagnosticsModeInput.Unresolved
  selfCustodialShutdown = false
  disposition = DiagnosticsDisposition.Unresolved
}
