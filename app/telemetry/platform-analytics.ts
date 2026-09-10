import analytics from "@react-native-firebase/analytics"

import { reportBoundaryFault } from "./diagnostics"

/**
 * The single point of contact with the analytics platform SDK.
 *
 * This is **not** the telemetry transport. GA4 remains the custodial analytics platform,
 * unchanged by this PRD beyond relabelling (§5.2), and it is disqualified as a carrier of
 * self-custodial telemetry because it attaches `user_pseudo_id` to every event by
 * construction and that cannot be disabled — a device-stable identifier §5.6 forbids
 * (AD-17, OD-7). Self-custodial facts therefore go to the outbox and wait for the port;
 * they never pass through this file.
 *
 * What lives here is platform *control*: whether the SDK collects at all, and the
 * user-scoped identity it would otherwise merge into every event it does collect.
 */

/**
 * FR-70 / AD-9: collection runs on **Custodial only**. Enhanced, Anon and Unresolved all
 * disable it, because platform-automatic, screen and session events are inside the §5
 * contract rather than adjacent to it — each one carries `user_pseudo_id`, which is
 * outside the §5.3 allowlist whatever the payload says.
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
