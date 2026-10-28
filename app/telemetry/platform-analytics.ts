import analytics from "@react-native-firebase/analytics"

import { reportBoundaryFault } from "./diagnostics"

/**
 * The single point of contact with the analytics platform SDK.
 *
 * This is **not** the telemetry transport. Custodial contract events ride GA4 and this is
 * their carrier: `logPlatformEvent` is the one place they are handed over. Self-custodial
 * contract events never pass through this file — they go to the outbox and leave through the
 * transport port, so a settlement fact lands in our own warehouse rather than the vendor's.
 *
 * What lives here is platform *control*: whether the SDK collects at all, the user-scoped
 * identity it would otherwise merge into every event it does collect, and the custodial
 * hand-off.
 *
 * One SDK limit shapes the first of those, and it is measured rather than assumed:
 * collection is a single boolean. `first_open`, `session_start` and `user_engagement` are
 * SDK-generated with no per-event switch, and the only other controls the bridge exposes are
 * `setSessionTimeoutDuration` and `setConsent`, which on mobile nulls the app-instance id
 * rather than splitting automatic events from custom ones. Verified against
 * `@react-native-firebase/analytics@23.3.1`. So a mode that collects gets the automatic
 * events too, and turning collection on for a mode is a decision about the identifiers
 * riding those events, not only about the events the app sends itself.
 */

/**
 * Collection runs on **Custodial and Enhanced**. Anon and Unresolved disable it: the SDK's
 * automatic, screen and session events are telemetry like any other, and a device that must
 * emit nothing may not send them either.
 *
 * On Enhanced the SDK attaches its own app-instance identifier, which is allowed. What is
 * not allowed is naming the account behind it: the ledger id and the user properties are
 * permitted on Custodial alone, so the platform may count an Enhanced instance and may not
 * join it to a Blink account.
 */
/**
 * Every call to the SDK goes through here, and the seam never throws. `analytics()` throws
 * *synchronously* when the native module is not linked, and the gate is initialised at
 * module scope during bundle evaluation — an unhandled throw there is a white screen with
 * no way back. A fault is reported and the caller
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
 * `setUserId` was called once in the app with the Blink ledger account id and never
 * cleared; Firebase merges `user_id` into every subsequent event, so a self-custodial
 * event would inherit a prohibited identifier without any call site doing anything
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
 * `user_id`.
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
    if (userId) markIdentityApplied(true)
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

/**
 * Whether the ledger account id has ridden this app instance since it was last reset.
 *
 * Clearing `user_id` stops the ledger account riding *future* events and does nothing about
 * the ones already sent. Those rows carry the same app-instance id the device keeps using, so
 * a device that collected as Custodial and later runs a self-custodial account is joinable to
 * its ledger account through its own history — no call site having done anything wrong. That
 * debt is what this records, and it outlives the process: a user can log out of custodial
 * today and open their self-custodial wallet next week.
 *
 * It starts `true`. An install with no record of it may have carried the id under an earlier
 * build, and the cost of being wrong the other way is a join the privacy ruling forbids; the
 * cost this way is one app-instance reset on the first self-custodial session.
 */
let identityAppliedSinceReset = true
let identityAppliedListener: ((applied: boolean) => void) | null = null

const markIdentityApplied = (applied: boolean): void => {
  if (identityAppliedSinceReset === applied) return
  identityAppliedSinceReset = applied
  identityAppliedListener?.(applied)
}

export const isPlatformIdentityApplied = (): boolean => identityAppliedSinceReset

/** What the device persisted, applied before the first mode resolves. Never notifies. */
export const restorePlatformIdentityApplied = (applied: boolean): void => {
  identityAppliedSinceReset = applied
}

/** Fires on every change, so the provider can persist it. */
export const onPlatformIdentityAppliedChanged = (
  listener: (applied: boolean) => void,
): (() => void) => {
  identityAppliedListener = listener
  return () => {
    if (identityAppliedListener === listener) identityAppliedListener = null
  }
}

/**
 * Resets the SDK's own app-instance identifier, and with it everything the platform holds
 * for this install, so rows sent from here on share no identifier with the ones that carried
 * the ledger id. The debt is cleared only once the SDK confirms: a reset that failed is owed
 * again at the next self-custodial session.
 */
export const resetPlatformAnalyticsData = (): void => {
  withAnalytics("reset analytics data", (client) =>
    client.resetAnalyticsData().then(() => markIdentityApplied(false)),
  )
}

export const resetPlatformIdentityForTesting = (): void => {
  identityPermitted = false
  identityAppliedSinceReset = true
  identityAppliedListener = null
  requested = { properties: {} }
  propertiesSetThisSession.clear()
  for (const key of KNOWN_USER_PROPERTIES) propertiesSetThisSession.add(key)
}

/**
 * The custodial carrier. Only the boundary calls this, and only for a payload the
 * policy stage has already approved for a `Custodial` device — the routing decision is
 * `index.ts`'s, made from the resolved mode, never from the call site.
 */
export const logPlatformEvent = (
  event: string,
  params: Readonly<Record<string, string | number | boolean>>,
): void => {
  withAnalytics(`platform log: ${event}`, (client) => client.logEvent(event, params))
}
