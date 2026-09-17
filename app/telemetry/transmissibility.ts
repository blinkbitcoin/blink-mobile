/**
 * Whether anything at all may leave this device right now (AD-13, AD-30).
 *
 * One flag, no imports, so both ends of the app can read it without a cycle: the
 * boundary's own diagnostics on one side, and the app-wide Crashlytics sink in
 * `app/utils/error-reporting.ts` on the other. `mode.ts` pushes the value on every
 * transition; the default is **false**, so a failure to resolve a mode leaves every
 * diagnostic silent, like everything else.
 *
 * True on `Custodial` and `Enhanced`. False on `Anon` and `Unresolved` — an incognito
 * device emits zero telemetry of any kind (NFR-P1), and a Crashlytics non-fatal or
 * breadcrumb is a transmission with a device-stable installation id on it.
 */

let transmissible = false

type Listener = (transmissible: boolean) => void
const listeners = new Set<Listener>()

/** The sink subscribes so it can release what it held once a device may report, or drop
 *  it once the device turns out to be one that may not. */
export const onTransmissibilityChanged = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * A withdrawal always notifies, even when the value was already false: the transition
 * `Unresolved → Anon` changes nothing about what may leave, but it does settle that what
 * was held while unresolved belongs to an incognito device, and the sink must drop it
 * rather than keep it for a grant that may come after a later switch to Enhanced.
 */
export const setDiagnosticsTransmissible = (next: boolean): void => {
  const changed = next !== transmissible
  transmissible = next
  if (!changed && next) return
  for (const listener of listeners) listener(next)
}

export const mayTransmitDiagnostics = (): boolean => transmissible
