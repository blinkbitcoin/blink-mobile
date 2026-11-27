/* eslint-disable camelcase */

/**
 * The region check as Enhanced telemetry reports it (`sc_region_checked`, KB-27,
 * blink-wip#2147): closed values and booleans only, and never a country. GA4 derives
 * geography at collection, and the app never sends a country of its own.
 */
export const ScRegionOutcome = {
  Allowed: "allowed",
  Restricted: "restricted",
  /** No country resolved. */
  Unknown: "unknown",
} as const

export type ScRegionOutcome = (typeof ScRegionOutcome)[keyof typeof ScRegionOutcome]

export type RegionCheckParams = {
  region_outcome: ScRegionOutcome
  dollar_balance_restricted: boolean
  transfer_restricted: boolean
}

/** Both verdicts a session runs: the sanctions check (`useRestrictedRegion`) and the
 *  feature gates (`useAccountRestrictions`). */
export type RegionCheckInputs = {
  isRestrictedRegion: boolean
  isRestrictedRegionEvaluationPending: boolean
  dollarBalance: boolean
  transfer: boolean
  isSettled: boolean
  isRegionDetermined: boolean
}

/**
 * The session's settled region verdict, or null while either check may still change.
 * Pending covers registry hydration, the IP lookup and the remote-config fetch, through
 * the two flags each check already keeps for it.
 *
 * - `restricted` when the sanctions check restricts, or a resolved country closes a
 *   feature gate. A sanctions verdict needs a country of its own, so it counts even
 *   when the gates' country has not resolved.
 * - `unknown` when no country resolved and the sanctions check did not restrict.
 * - `allowed` otherwise.
 *
 * The two booleans report the feature gates exactly as they stand.
 */
export const regionCheckOutcome = ({
  isRestrictedRegion,
  isRestrictedRegionEvaluationPending,
  dollarBalance,
  transfer,
  isSettled,
  isRegionDetermined,
}: RegionCheckInputs): RegionCheckParams | null => {
  if (isRestrictedRegionEvaluationPending || !isSettled) return null

  const regionOutcome = (() => {
    if (isRestrictedRegion) return ScRegionOutcome.Restricted
    if (!isRegionDetermined) return ScRegionOutcome.Unknown
    if (dollarBalance || transfer) return ScRegionOutcome.Restricted
    return ScRegionOutcome.Allowed
  })()

  return {
    region_outcome: regionOutcome,
    dollar_balance_restricted: dollarBalance,
    transfer_restricted: transfer,
  }
}
