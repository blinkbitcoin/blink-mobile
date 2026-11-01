/* eslint-disable camelcase */
import AsyncStorage from "@react-native-async-storage/async-storage"
import analytics from "@react-native-firebase/analytics"

import {
  closeCrashReporting,
  enableCrashCollection,
  recordAppError,
  releaseHeldCrashReports,
  setCrashReportingOpen,
  toError,
} from "@app/utils/error-reporting"

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
/** Bumped by every domain request: a run belongs to the request it started for, and stops
 *  before its next step once a newer one is made, even one for the same domain. */
let requestEpoch = 0
/** The domain whose identity and collection state is fully applied right now; null while
 *  a transition is under way or after one failed. Self-custodial events are delivered
 *  only while this is Enhanced, and custodial-era ones only while it is Custodial. */
let appliedDomain: AnalyticsDomain | null = null
let custodialIdentity: CustodialIdentity | null = null
let sharedProperties: Record<string, string> = {}
let appliedSide: Side | null = null
let queue: Promise<void> = Promise.resolve()
/** Every shutdown issued so far. Shutdowns run ahead of the queue, so a transition waits
 *  for them before its first step: a late shutdown setter can then never land over a
 *  newer identity. */
let shutdownBarrier: Promise<unknown> = Promise.resolve()
const enhancedAppliedListeners = new Set<() => void>()

type Step = () => Promise<unknown>

/** A custodial-era event made while the custodial identity was still being put in place.
 *  It belongs to the request it was made under: every new request clears the held ones. */
type HeldCustodialEvent = { heldAtMs: number; send: () => unknown }

/** The same bounds as the Enhanced deliveries in `measurement`. */
const HELD_CUSTODIAL_TTL_MS = 5 * 60 * 1000
const HELD_CUSTODIAL_CAP = 50
let heldCustodialEvents: HeldCustodialEvent[] = []

/** Sends what the request that just applied the custodial identity was holding; anything
 *  past its time is dropped. Each event is sent at most once. */
const releaseHeldCustodialEvents = () => {
  const now = Date.now()
  const held = heldCustodialEvents
  heldCustodialEvents = []
  held.forEach((event) => {
    if (now - event.heldAtMs <= HELD_CUSTODIAL_TTL_MS) event.send()
  })
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

/** Crash reports follow the same domains as GA4. Opening is three steps, so `runSteps`
 *  checks the request between each: a newer Incognito request during the delete stops
 *  the run before collection is enabled, and one during the enable stops it before the
 *  gate reopens. That request's own shutdown and closed run then switch collection back
 *  off, so an enable already issued never outlives it. A launch that started with
 *  reports held keeps crash reporting shut to its end, while GA4 still opens. */
const openCrashReportingSteps = (): Step[] => {
  let mayOpen = false
  return [
    async () => {
      mayOpen = await releaseHeldCrashReports()
    },
    async () => {
      if (mayOpen) await enableCrashCollection()
    },
    async () => {
      if (mayOpen) setCrashReportingOpen(true)
    },
  ]
}

/** Identity off first, collection second: nothing already queued keeps the id. Issued
 *  without waiting in between, so it can run ahead of a queued transition; every later
 *  transition waits for it through `shutdownBarrier`. */
const issueShutdown = (): Promise<unknown> => {
  const ga = analytics()
  const shutdown = Promise.all([
    ga.setUserId(null),
    ga.setUserProperty("account_mode", null),
    ga.setAnalyticsCollectionEnabled(false),
    closeCrashReporting(),
  ]).catch(() => undefined)
  shutdownBarrier = Promise.all([shutdownBarrier, shutdown])
  return shutdown
}

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
        closeCrashReporting,
      ]
    case AnalyticsDomain.Enhanced:
      /** Identity before collection: the first automatic event already carries it. */
      return [
        () => ga.setUserId(enhancedId),
        () => ga.setUserProperty("account_mode", "enhanced"),
        () => ga.setAnalyticsCollectionEnabled(true),
        ...openCrashReportingSteps(),
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
        ...openCrashReportingSteps(),
      ]
    }
  }
}

/** Runs the steps in order, each awaited, stopping before any step once a newer request
 *  has superseded this one: a late step could otherwise re-enable collection an Incognito
 *  switch just shut. True when every step ran for a request that is still the latest. */
const runSteps = async (isCurrent: () => boolean, steps: Step[]): Promise<boolean> => {
  for (const step of steps) {
    if (!isCurrent()) return false
    await step()
  }
  return isCurrent()
}

const announceEnhancedApplied = () => {
  enhancedAppliedListeners.forEach((listener) => {
    try {
      listener()
    } catch (err) {
      recordAppError(toError(err))
    }
  })
}

const applyLatest = async () => {
  const target = desiredDomain
  if (!target) return
  const epoch = requestEpoch
  const isCurrent = () => requestEpoch === epoch
  /** A re-application (a custodial identity update, or a second run queued for the same
   *  request) is not news: only a domain newly in place is announced. */
  const wasApplied = appliedDomain === target
  if (!wasApplied) appliedDomain = null

  try {
    await shutdownBarrier
    /** Read before anything changes: without the per-install id there is no Enhanced
     *  identity to move to, and the failure below closes collection instead. */
    const enhancedId =
      target === AnalyticsDomain.Enhanced ? await getTelemetryInstanceId() : null
    if (!isCurrent()) return

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

    const isApplied = await runSteps(isCurrent, stepsFor(target, enhancedId))
    if (!isApplied) return

    /** Runs are serialized through `queue`; a request made meanwhile bumps the epoch, and
     *  the check above has already stopped this run. */
    // eslint-disable-next-line require-atomic-updates
    appliedDomain = target
    if (target === AnalyticsDomain.Enhanced && !wasApplied) announceEnhancedApplied()
    if (target === AnalyticsDomain.Custodial) releaseHeldCustodialEvents()
  } catch (err) {
    /** Fail closed: a self-custodial account whose identity could not be put in place
     *  collects nothing, rather than reporting under whatever identity was left. The
     *  cleanup is awaited, so the next run starts after it. */
    if (target !== AnalyticsDomain.Custodial && isCurrent()) await issueShutdown()
    throw err
  }
}

const enqueue = () => {
  /** Through the gate: a transition that failed into a closed domain stays on the
   *  device, and so does a failed close itself. */
  queue = queue.then(applyLatest).catch((err) => {
    recordAppError(toError(err))
  })
}

/**
 * The single owner of GA4 identity: which user id is attached, which identifying user
 * properties are set, and whether collection runs, for GA4 and for Crashlytics alike.
 * Transitions are serialized, every
 * step is awaited, and every run applies the latest request, so a slow step (the reset,
 * the per-install id read) can never land an older identity over a newer one.
 */
export const setAnalyticsDomain = (domain: AnalyticsDomain): void => {
  desiredDomain = domain
  requestEpoch += 1
  appliedDomain = null
  /** Held for a request that no longer stands: dropped rather than sent under the
   *  identity that replaces it. */
  heldCustodialEvents = []
  if (isClosed(domain)) {
    /** Incognito, or no answer yet, does not wait behind a queued transition. */
    issueShutdown()
  }
  enqueue()
}

/** Whether the custodial account is the one requested: the custodial-era events in
 *  `utils/analytics` belong to it, leaving a self-custodial account to the sc_* events.
 *  False until the first request, so nothing reports for an unknown account. Whose an
 *  event is, not when it may go: `reportCustodialEvent` decides that. */
export const isCustodialAnalyticsDomain = (): boolean =>
  desiredDomain === AnalyticsDomain.Custodial

/**
 * Sends a custodial-era event only under the custodial identity. While a transition to the
 * custodial account is still separating from the self-custodial app instance, attaching
 * the custodial id or turning collection on, the event is held for that request and sent
 * once it applies: sent sooner, it would go out under the previous app instance, or be
 * dropped by collection that is still off. A newer request drops it, and so does any
 * request other than the custodial account.
 */
export const reportCustodialEvent = (send: () => unknown): void => {
  if (appliedDomain === AnalyticsDomain.Custodial) {
    send()
    return
  }
  if (desiredDomain !== AnalyticsDomain.Custodial) return
  if (heldCustodialEvents.length >= HELD_CUSTODIAL_CAP) heldCustodialEvents.shift()
  heldCustodialEvents.push({ heldAtMs: Date.now(), send })
}

/** Whether GA4 is fully under the Enhanced identity right now: separated from the
 *  custodial account, the per-install id attached, and collection on. */
export const isEnhancedIdentityApplied = (): boolean =>
  appliedDomain === AnalyticsDomain.Enhanced

/** Called each time a transition finishes applying the Enhanced identity, for events
 *  that were waiting for it. */
export const onEnhancedIdentityApplied = (listener: () => void): (() => void) => {
  enhancedAppliedListeners.add(listener)
  return () => enhancedAppliedListeners.delete(listener)
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
