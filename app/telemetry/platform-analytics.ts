import analytics from "@react-native-firebase/analytics"

import { reportBoundaryFault } from "./diagnostics"

/**
 * The single point of contact with the analytics platform SDK.
 *
 * This is **not** the telemetry transport. OD-7 is ruled — PRD CD-7: custodial analytics
 * stay on GA4, and the first adapter for Enhanced telemetry is a Blink endpoint behind the
 * port. Self-custodial facts go to the outbox and wait for that port; they never pass
 * through this file. Custodial contract events do: under CD-7 this is their carrier, and
 * `logPlatformEvent` is the one place they are handed over.
 *
 * How the ruling was reached matters here because this file is where the alternative
 * would have lived. The 09-11 re-review tolerated GA4's `user_pseudo_id` as a scoped
 * exception (CD-6) and would have kept collection on for Enhanced so contract events could
 * ride Firebase. That needed the SDK to suppress its automatic events while `logEvent()`
 * stayed live — the spine's Q13, assigned to mobile. **Verified against
 * `@react-native-firebase/analytics@23.3.1`: it cannot.** `first_open`, `session_start`
 * and `user_engagement` are SDK-generated reserved events with no per-event switch; the
 * only controls the bridge exposes are `setAnalyticsCollectionEnabled` (a single boolean),
 * `setSessionTimeoutDuration`, and `setConsent`, which on mobile nulls the app-instance id
 * rather than splitting automatic from custom events. FR-70 and Enhanced-over-Firebase are
 * mutually exclusive, which is what closed CD-6 and produced CD-7.
 *
 * What lives here is platform *control*: whether the SDK collects at all, the user-scoped
 * identity it would otherwise merge into every event it does collect, and the custodial
 * hand-off.
 */

/**
 * FR-70: collection runs on **Custodial only**. Enhanced, Anon and Unresolved all disable
 * it, because platform-automatic, screen and session events are inside the §5 contract
 * rather than adjacent to it — each one carries `user_pseudo_id`, which is outside the §5.3
 * allowlist whatever the payload says.
 *
 * The accepted cost is stated in the PRD: the board's app-instance tile and
 * platform-derived geography become custodial-only from P2.
 */
/**
 * Every call to the SDK goes through here, and the seam never throws. `analytics()` throws
 * *synchronously* when the native module is not linked, and the gate is initialised at
 * module scope during bundle evaluation — an unhandled throw there is a white screen with
 * no way back (the sixth review's second blocker). A fault is reported and the caller
 * carries on, the treatment `captureTelemetryFact` already gets for the same reason.
 */
const withAnalytics = (
  what: string,
  use: (client: ReturnType<typeof analytics>) => Promise<unknown>,
): void => {
  try {
    use(analytics()).catch((err) => {
      reportBoundaryFault(what, err)
    })
  } catch (err) {
    reportBoundaryFault(what, err)
  }
}

export const setPlatformCollectionEnabled = (enabled: boolean): void => {
  withAnalytics("platform collection toggle", (client) =>
    client.setAnalyticsCollectionEnabled(enabled),
  )
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

/**
 * Pushed by `mode.ts` on every transition. A setter that checked the mode itself would
 * need to import it, and `mode.ts` already imports this file; a flag keeps the graph a
 * tree and the default at deny.
 *
 * A grant *replays* what the container last asked for. Its effects run on the first
 * commit — the ledger id straight out of the persisted Apollo cache, the instance name
 * from config — and never again while those values stand, while permission arrives only
 * once the mode has resolved and its queued side effects have run. Refusing those calls
 * without remembering them shipped every custodial event of the session without a
 * `user_id` (the fifth review's second blocker).
 */
let identityPermitted = false

/** What the container last asked for, whether or not it could be applied at the time. */
let requested: { userId?: string | null; properties: Record<string, string | null> } = {
  properties: {},
}

export const setCustodialIdentityPermitted = (permitted: boolean): void => {
  identityPermitted = permitted
  if (!permitted) return
  const { userId, properties } = requested
  if (userId === undefined && Object.keys(properties).length === 0) return
  push({
    userId,
    properties: Object.keys(properties).length > 0 ? properties : undefined,
  })
}

/**
 * Every user-property key the custodial container has ever set, so a clear can reach all
 * of them. Firebase persists user properties natively across sessions, so the fixed list
 * covers keys a previous launch set that this process has not seen; the live set covers
 * anything added since.
 */
const KNOWN_USER_PROPERTIES = ["hasUsername", "network", "accountLevel", "galoyInstance"]
const propertiesSetThisSession = new Set<string>(KNOWN_USER_PROPERTIES)

/**
 * Applied only while the resolved mode is positively `Custodial`; remembered always. The
 * container that calls this runs its effects on GraphQL, config and level changes, any of
 * which can land after a switch to a self-custodial account — and Firebase would then
 * merge the ledger id into every subsequent event. Clearing once at the transition is not
 * enough on its own; the setter has to refuse. What it refuses it keeps, so the grant
 * that follows the mode's resolution can apply it (see `setCustodialIdentityPermitted`).
 */
export const setCustodialAnalyticsIdentity = ({
  userId,
  properties,
}: CustodialIdentity): void => {
  requested = {
    userId: userId === undefined ? requested.userId : userId,
    properties: { ...requested.properties, ...properties },
  }
  if (!identityPermitted) return
  push({ userId, properties })
}

const push = ({ userId, properties }: CustodialIdentity): void => {
  if (userId !== undefined) {
    withAnalytics("set analytics user id", (client) => client.setUserId(userId))
  }
  if (properties) {
    for (const key of Object.keys(properties)) propertiesSetThisSession.add(key)
    withAnalytics("set analytics user properties", (client) =>
      client.setUserProperties(properties),
    )
  }
}

/** Clears every user-scoped identifier the platform SDK would otherwise carry forward —
 *  the user id and every user property — whenever the resolved mode stops being
 *  `Custodial`. */
export const clearCustodialAnalyticsIdentity = (): void => {
  withAnalytics("clear analytics user id", (client) => client.setUserId(null))
  const cleared: Record<string, null> = {}
  for (const key of propertiesSetThisSession) cleared[key] = null
  withAnalytics("clear analytics user properties", (client) =>
    client.setUserProperties(cleared),
  )
}

export const resetPlatformIdentityForTesting = (): void => {
  identityPermitted = false
  requested = { properties: {} }
  propertiesSetThisSession.clear()
  for (const key of KNOWN_USER_PROPERTIES) propertiesSetThisSession.add(key)
}

/**
 * The custodial carrier (CD-7). Only the boundary calls this, and only for a payload the
 * policy stage has already approved for a `Custodial` device — the routing decision is
 * `index.ts`'s, made from the resolved mode, never from the call site.
 */
export const logPlatformEvent = (
  event: string,
  params: Readonly<Record<string, string | number | boolean>>,
): void => {
  withAnalytics(`platform log: ${event}`, (client) => client.logEvent(event, params))
}
