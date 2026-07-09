/**
 * TODO: TEMPORARY central mock of the backend migration/wind-down contract — every value
 * here must be replaced by the real backend query once it is ready. Nothing outside this
 * file hardcodes wind-down data: screens read it through hooks (useWindDownStatus), so
 * swapping the mock for the real query later touches only this layer.
 */

/**
 * The wind-down phase of the custodial account, as the BACKEND reports it. The client
 * only renders the phase it receives; it never computes it from dates (a date can slip
 * server-side and the status must follow the server, not the clock). Each phase drives
 * different UI:
 * - PreCutoff (before Aug 1): account works normally; the app only shows the migration
 *   bulletin and the voluntary/forced intro copy.
 * - ReceiveDisabled (Aug 1 to Aug 31): receiving is turned off; the home greys out
 *   Receive, Send/Scan keep working, and the dismissible "Migrate now" modal appears.
 * - GatedClosed (from Sep 1): the account is closed for everything except the guided
 *   migration; the app shows the non-dismissible "Account not accessible" gate, and the
 *   flow accepts entering WITH dollars because its final step converts them to bitcoin.
 */
export const WindDownStatus = {
  PreCutoff: "PRE_CUTOFF",
  ReceiveDisabled: "RECEIVE_DISABLED",
  GatedClosed: "GATED_CLOSED",
} as const

export type WindDownStatus = (typeof WindDownStatus)[keyof typeof WindDownStatus]

/**
 * Shape of the backend wind-down state (Account.windDown in the integration contract).
 * Dates are Unix SECONDS and exist only for display copy ("by the end of 31st of
 * August"); the timezone is the IANA zone the backend defines per region so every date
 * renders in the enforcement timezone (00:00 CET baseline) instead of the device's.
 */
export type WindDown = {
  status: WindDownStatus
  /** When receiving gets disabled (phase 2 starts). Display only. */
  receiveDisabledAt: number
  /** Last day to initiate an exit; the date shown in the "Migrate now" modal. */
  finalDeadline: number
  /** When the blocking gate arms (phase 3 starts). Display only. */
  gateArmsAt: number
  /** IANA timezone for rendering the dates above, e.g. "Europe/Paris" (CET/CEST). */
  timezone: string
}

const toUnixSeconds = (utcMilliseconds: number): number => utcMilliseconds / 1000

/**
 * TODO: TEMPORARY — replace with the backend wind-down status query (Account.windDown)
 * once it is ready. The dates below are the published wind-down timeline; 00:00 in
 * Europe/Paris is 22:00 UTC of the previous day because August/September fall in CEST
 * (UTC+2). Change `status` here (or via the developer-screen simulations later) to see
 * each phase's UI.
 */
export const windDownMock: WindDown = {
  status: WindDownStatus.PreCutoff,
  /** Aug 1 2026, 00:00 Europe/Paris — receiving disabled from this moment. */
  receiveDisabledAt: toUnixSeconds(Date.UTC(2026, 6, 31, 22, 0, 0)),
  /** Aug 31 2026, end of day Europe/Paris — last day to initiate an exit. */
  finalDeadline: toUnixSeconds(Date.UTC(2026, 7, 31, 21, 59, 59)),
  /** Sep 1 2026, 00:00 Europe/Paris — the blocking migration gate arms. */
  gateArmsAt: toUnixSeconds(Date.UTC(2026, 7, 31, 22, 0, 0)),
  timezone: "Europe/Paris",
}

/**
 * TODO: TEMPORARY — remove once the backend serves the wind-down state. A mocked "today"
 * (Jul 9 2026, inside the pre-cutoff window) so simulations can reason about "where in
 * the timeline are we" consistently with the dates above; the real client never compares
 * dates to decide the phase, it obeys `status`.
 */
export const nowMock: number = toUnixSeconds(Date.UTC(2026, 6, 9, 12, 0, 0))
