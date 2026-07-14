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
 * Shape of the backend wind-down state (the authed top-level Query.windDown in the
 * integration contract). Dates are Unix SECONDS and exist only for display copy ("by
 * the end of 31st of August"); the timezone is the IANA zone the backend defines per
 * region so every date renders in the enforcement timezone (00:00 CET baseline)
 * instead of the device's.
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

/**
 * Shape of the backend migration preview (Account.migration.preview in the integration
 * contract): the server computes the network fee, whether Blink covers it, and the
 * resulting amount. The client renders these four fields verbatim and never does the
 * arithmetic itself.
 */
export type AccountMigrationPreview = {
  balanceSats: number
  feeSats: number
  feeCoveredByBlink: boolean
  receiveSats: number
}
