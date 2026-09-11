import analytics from "@react-native-firebase/analytics"

import { reportBoundaryFault } from "./diagnostics"

/**
 * The single point of contact with the analytics platform SDK.
 *
 * This is **not** the telemetry transport. GA4 remains the custodial analytics platform,
 * unchanged by this PRD beyond relabelling (§5.2). Self-custodial facts go to the outbox
 * and wait for the port; they never pass through this file.
 *
 * Why not, given CD-6. The D1 re-review of 2026-09-11 resolved OD-7 as a scoped exception:
 * GA4's `user_pseudo_id` is *tolerated* on the first adapter for the coexistence window,
 * and AD-9 was re-amended to keep collection on for Enhanced so contract events could ride
 * Firebase. That hinges on the spine's Q13 — whether the SDK can keep `logEvent()` live on
 * Enhanced while suppressing the automatic events FR-70 requires off — and Q13 is assigned
 * to mobile to verify. **Verified against `@react-native-firebase/analytics@23.3.1`: it
 * cannot.** `first_open`, `session_start` and `user_engagement` are SDK-generated reserved
 * events with no per-event switch; the only controls the bridge exposes are
 * `setAnalyticsCollectionEnabled` (a single boolean), `setSessionTimeoutDuration`, and
 * `setConsent`, which on mobile nulls the app-instance id rather than splitting automatic
 * from custom events. FR-70 and Enhanced-over-Firebase are therefore mutually exclusive,
 * and the spine's own branch applies: on Enhanced, FR-70 is satisfied only by the CD-6
 * fallback — Enhanced via an identity-free endpoint behind the port, custodial on GA4.
 *
 * What lives here is platform *control*: whether the SDK collects at all, and the
 * user-scoped identity it would otherwise merge into every event it does collect.
 */

/**
 * FR-70: collection runs on **Custodial only**. Enhanced, Anon and Unresolved all disable
 * it, because platform-automatic, screen and session events are inside the §5 contract
 * rather than adjacent to it — each one carries `user_pseudo_id`, which is outside the §5.3
 * allowlist whatever the payload says.
 *
 * AD-9's 2026-09-11 re-amendment would turn this on for Enhanced. It presupposes Q13; see
 * the header for why that presupposition fails on this SDK. Flipping it would emit the
 * automatic events FR-70 forbids on every Enhanced device, and the PRD's own risk table
 * names the fallback as the answer to exactly that.
 *
 * The accepted cost is stated in the PRD: the board's app-instance tile and
 * platform-derived geography become custodial-only from P2.
 */
export const setPlatformCollectionEnabled = (enabled: boolean): void => {
  analytics()
    .setAnalyticsCollectionEnabled(enabled)
    .catch((err) => {
      reportBoundaryFault("platform collection toggle", err)
    })
}

/**
 * AD-16. `setUserId` was called once in the app with the Blink ledger account ID and never
 * cleared; Firebase merges `user_id` into every subsequent event, so a self-custodial
 * event would inherit a §5.3-prohibited identifier without any call site doing anything
 * wrong. An import-path ban cannot see that — the call sat inside an already-allowed file
 * — so the calls live here and are banned by name everywhere else.
 */
export type CustodialIdentity = {
  userId?: string | null
  properties?: Record<string, string | null>
}

export const setCustodialAnalyticsIdentity = ({
  userId,
  properties,
}: CustodialIdentity): void => {
  const client = analytics()
  if (userId !== undefined) {
    client.setUserId(userId).catch((err) => {
      reportBoundaryFault("set analytics user id", err)
    })
  }
  if (properties) {
    client.setUserProperties(properties).catch((err) => {
      reportBoundaryFault("set analytics user properties", err)
    })
  }
}

/** Clears every user-scoped identifier the platform SDK would otherwise carry forward.
 *  Called whenever the resolved mode stops being `Custodial`. */
export const clearCustodialAnalyticsIdentity = (): void => {
  analytics()
    .setUserId(null)
    .catch((err) => {
      reportBoundaryFault("clear analytics user id", err)
    })
}
