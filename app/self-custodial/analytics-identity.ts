/* eslint-disable camelcase */
import AsyncStorage from "@react-native-async-storage/async-storage"
import analytics from "@react-native-firebase/analytics"
import crashlytics from "@react-native-firebase/crashlytics"

import { getTelemetryInstanceId } from "./telemetry-instance-id"

/** Who the active account is to GA4. */
export const AnalyticsDomain = {
  Custodial: "custodial",
  Enhanced: "enhanced",
  Anon: "anon",
  /** A self-custodial account that has not recorded a mode yet. */
  Unset: "unset",
} as const

export type AnalyticsDomain = (typeof AnalyticsDomain)[keyof typeof AnalyticsDomain]

export type CustodialIdentity = {
  userId?: string
  hasUsername: boolean
  accountLevel: string
}

const Side = {
  Custodial: "custodial",
  SelfCustodial: "self_custodial",
} as const

type Side = (typeof Side)[keyof typeof Side]

const LAST_SIDE_KEY = "analyticsIdentitySide"

/** User properties that describe the custodial account and must not follow the device
 *  into a self-custodial session: GA4 keeps a user property until it is overwritten. */
const CUSTODIAL_ONLY_PROPERTIES = {
  hasUsername: null,
  accountLevel: null,
  account_mode: null,
}

const sideOf = (domain: AnalyticsDomain): Side =>
  domain === AnalyticsDomain.Custodial ? Side.Custodial : Side.SelfCustodial

/** Domains under which nothing may leave the device: no identity, no collection. */
const isClosed = (domain: AnalyticsDomain): boolean =>
  domain === AnalyticsDomain.Anon || domain === AnalyticsDomain.Unset

let desiredDomain: AnalyticsDomain | null = null
/** The domain whose identity and collection state is fully applied right now; null while
 *  a transition is under way or after one failed. Self-custodial events go out only while
 *  this is Enhanced. */
let appliedDomain: AnalyticsDomain | null = null
/** The last domain a run finished applying, kept through a transition to tell a change of
 *  domain from a re-application of the same one. */
let lastAppliedDomain: AnalyticsDomain | null = null
let custodialIdentity: CustodialIdentity | null = null
let sharedProperties: Record<string, string> = {}
let appliedSide: Side | null = null
let queue: Promise<void> = Promise.resolve()

/**
 * Enhanced events that arrived before the Enhanced identity was in place: an onboarding
 * event measured against the mode just chosen while the custodial account (or an
 * Incognito one) is still the active identity, or any event emitted during the
 * transition itself. They wait for the identity rather than going out under the wrong
 * one, and are dropped if the device lands anywhere else, or after a while: an onboarding
 * left unfinished is not reported against whatever Enhanced session comes much later.
 */
const PENDING_DELIVERY_TTL_MS = 5 * 60 * 1000
const PENDING_DELIVERY_CAP = 50
let pendingDeliveries: Array<{ deliver: () => void; queuedAtMs: number }> = []

const pruneExpired = () => {
  const now = Date.now()
  pendingDeliveries = pendingDeliveries.filter(
    ({ queuedAtMs }) => now - queuedAtMs <= PENDING_DELIVERY_TTL_MS,
  )
}

const settlePendingDeliveries = (previous: AnalyticsDomain | null) => {
  pruneExpired()
  if (appliedDomain === AnalyticsDomain.Enhanced) {
    const ready = pendingDeliveries
    pendingDeliveries = []
    ready.forEach(({ deliver }) => deliver())
    return
  }
  /** Landing on another domain ends the wait; re-applying the one already in place (a
   *  custodial identity update during an onboarding) does not. */
  if (appliedDomain !== previous) pendingDeliveries = []
}

const readLastSide = async (): Promise<Side | null> => {
  try {
    const stored = await AsyncStorage.getItem(LAST_SIDE_KEY)
    return stored === Side.Custodial || stored === Side.SelfCustodial ? stored : null
  } catch {
    return null
  }
}

/**
 * Cuts GA4's thread between the custodial account and a self-custodial session. Clearing
 * the user id only governs events still to come: the rows already sent carry the same
 * app-instance id, so without a fresh instance one `user_pseudo_id` join ties the
 * self-custodial rows (and the per-install id they carry) back to `me.id`.
 */
const separate = async () => {
  const ga = analytics()
  await ga.setUserId(null)
  await ga.setUserProperties(CUSTODIAL_ONLY_PROPERTIES)
  await ga.resetAnalyticsData()
  /** Non-identifying, and lost with the reset; the new instance gets them back. */
  await ga.setUserProperties(sharedProperties)
}

/** Identity off first, collection second: nothing already queued keeps the id. Issued
 *  without waiting in between, so it can run ahead of a queued transition. */
const shutCollection = (): Promise<unknown> => {
  const ga = analytics()
  return Promise.all([
    ga.setUserId(null),
    ga.setUserProperty("account_mode", null),
    ga.setAnalyticsCollectionEnabled(false),
  ])
}

type Step = () => Promise<unknown>

const stepsFor = (domain: AnalyticsDomain, enhancedId: string | null): Step[] => {
  const ga = analytics()
  switch (domain) {
    case AnalyticsDomain.Anon:
    case AnalyticsDomain.Unset:
      /** An unset mode has not consented to anything, so it is as closed as Incognito
       *  until the mode sync settles one. */
      return [
        () => ga.setUserId(null),
        () => ga.setUserProperty("account_mode", null),
        () => ga.setAnalyticsCollectionEnabled(false),
      ]
    case AnalyticsDomain.Enhanced:
      /** Identity before collection: the first automatic event already carries it. */
      return [
        () => ga.setUserId(enhancedId),
        () => ga.setUserProperty("account_mode", "enhanced"),
        () => ga.setAnalyticsCollectionEnabled(true),
      ]
    case AnalyticsDomain.Custodial: {
      const identity = custodialIdentity
      const identitySteps: Step[] = identity
        ? [
            () =>
              ga.setUserProperty("hasUsername", identity.hasUsername ? "true" : "false"),
            () => ga.setUserProperty("accountLevel", identity.accountLevel),
            ...(identity.userId ? [() => ga.setUserId(identity.userId ?? null)] : []),
          ]
        : []
      return [
        ...identitySteps,
        () => ga.setUserProperty("account_mode", "custodial"),
        () => ga.setAnalyticsCollectionEnabled(true),
      ]
    }
  }
}

/** Runs the steps in order, each awaited, stopping before any step once a newer request
 *  has superseded this one: a late step could otherwise re-enable collection an Incognito
 *  switch just shut. True when every step ran for a target that is still wanted. */
const runSteps = async (target: AnalyticsDomain, steps: Step[]): Promise<boolean> => {
  for (const step of steps) {
    if (desiredDomain !== target) return false
    await step()
  }
  return desiredDomain === target
}

const applyLatest = async () => {
  const target = desiredDomain
  if (!target) return
  if (appliedDomain !== target) appliedDomain = null

  try {
    /** Read before anything changes: without the per-install id there is no Enhanced
     *  identity to move to, and the failure below closes collection instead. */
    const enhancedId =
      target === AnalyticsDomain.Enhanced ? await getTelemetryInstanceId() : null

    const side = sideOf(target)
    if (appliedSide !== side) {
      /** The first run of a process compares against the side the last one ended on.
       *  With no record (a fresh install, or the release that introduces this), a
       *  custodial start has nothing to separate from, while a self-custodial one may be
       *  continuing rows written under the custodial id. */
      const previous = appliedSide ?? (await readLastSide())
      const mustSeparate =
        previous === null ? side === Side.SelfCustodial : previous !== side
      if (mustSeparate) await separate()
      /** Runs are serialized through `queue`, so no other run writes this meanwhile. */
      // eslint-disable-next-line require-atomic-updates
      appliedSide = side
      await AsyncStorage.setItem(LAST_SIDE_KEY, side)
    }

    const isApplied = await runSteps(target, stepsFor(target, enhancedId))
    if (!isApplied) return

    const previous = lastAppliedDomain
    /** Runs are serialized through `queue`; a request made meanwhile only ever clears
     *  this, and the run it queued applies its own target next. */
    // eslint-disable-next-line require-atomic-updates
    appliedDomain = target
    lastAppliedDomain = target
    settlePendingDeliveries(previous)
  } catch (err) {
    /** Fail closed: a self-custodial account whose identity could not be put in place
     *  collects nothing, rather than reporting under whatever identity was left. */
    if (target !== AnalyticsDomain.Custodial && desiredDomain === target) {
      shutCollection().catch(() => undefined)
    }
    throw err
  }
}

const enqueue = () => {
  queue = queue.then(applyLatest).catch((err) => {
    crashlytics().recordError(err instanceof Error ? err : new Error(String(err)))
  })
}

/**
 * The single owner of GA4 identity: which user id is attached, which identifying user
 * properties are set, and whether collection runs. Transitions are serialized, every
 * step is awaited, and every run applies the latest request, so a slow step (the reset,
 * the per-install id read) can never land an older identity over a newer one.
 */
export const setAnalyticsDomain = (domain: AnalyticsDomain): void => {
  desiredDomain = domain
  if (domain !== appliedDomain) appliedDomain = null
  if (isClosed(domain)) {
    /** Incognito, or no answer yet, does not wait behind a queued transition. */
    shutCollection().catch(() => undefined)
  }
  enqueue()
}

/**
 * Hands a self-custodial event to GA4 only under the Enhanced identity: at once when it
 * is fully in place, otherwise once a transition puts it there. Measurement decides
 * whether an event may be sent at all; this decides when it is safe to.
 */
export const deliverUnderEnhancedIdentity = (deliver: () => void): void => {
  if (appliedDomain === AnalyticsDomain.Enhanced) {
    deliver()
    return
  }
  pruneExpired()
  if (pendingDeliveries.length >= PENDING_DELIVERY_CAP) pendingDeliveries.shift()
  pendingDeliveries.push({ deliver, queuedAtMs: Date.now() })
}

/** The custodial account's identity, attached only while the custodial account is the
 *  active one; held until then. */
export const setCustodialIdentity = (identity: CustodialIdentity): void => {
  custodialIdentity = identity
  enqueue()
}

/** User properties that describe the app, not the person, kept on every side. */
export const setSharedUserProperties = (properties: Record<string, string>): void => {
  sharedProperties = { ...sharedProperties, ...properties }
  Promise.resolve(analytics().setUserProperties(properties)).catch(() => undefined)
}
