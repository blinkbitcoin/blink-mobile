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

let desiredDomain: AnalyticsDomain | null = null
let custodialIdentity: CustodialIdentity | null = null
let sharedProperties: Record<string, string> = {}
let appliedSide: Side | null = null
let queue: Promise<void> = Promise.resolve()

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

const applyDomain = (domain: AnalyticsDomain, enhancedId: string | null) => {
  const ga = analytics()
  switch (domain) {
    case AnalyticsDomain.Anon:
      /** Identity off first, collection second: nothing already queued keeps the id. */
      ga.setUserId(null)
      ga.setAnalyticsCollectionEnabled(false)
      return
    case AnalyticsDomain.Enhanced:
      ga.setAnalyticsCollectionEnabled(true)
      ga.setUserProperty("account_mode", "enhanced")
      ga.setUserId(enhancedId)
      return
    case AnalyticsDomain.Unset:
      /** Pre-mode accounts were never asked anything, so collection stays on; no
       *  identity is attached until the mode sync settles one. */
      ga.setAnalyticsCollectionEnabled(true)
      ga.setUserId(null)
      return
    case AnalyticsDomain.Custodial:
      ga.setAnalyticsCollectionEnabled(true)
      ga.setUserProperty("account_mode", "custodial")
      if (!custodialIdentity) return
      ga.setUserProperty("hasUsername", custodialIdentity.hasUsername ? "true" : "false")
      ga.setUserProperty("accountLevel", custodialIdentity.accountLevel)
      if (custodialIdentity.userId) ga.setUserId(custodialIdentity.userId)
  }
}

const applyLatest = async () => {
  const target = desiredDomain
  if (!target) return

  const side = sideOf(target)
  if (appliedSide !== side) {
    /** The first run of a process compares against the side the last one ended on. With
     *  no record (a fresh install, or the release that introduces this), a custodial
     *  start has nothing to separate from, while a self-custodial one may be continuing
     *  rows written under the custodial id. */
    const previous = appliedSide ?? (await readLastSide())
    const mustSeparate =
      previous === null ? side === Side.SelfCustodial : previous !== side
    if (mustSeparate) await separate()
    /** Runs are serialized through `queue`, so no other run writes this meanwhile. */
    // eslint-disable-next-line require-atomic-updates
    appliedSide = side
    await AsyncStorage.setItem(LAST_SIDE_KEY, side)
  }

  const enhancedId =
    target === AnalyticsDomain.Enhanced
      ? await getTelemetryInstanceId().catch(() => null)
      : null

  /** Superseded while awaiting: the run queued by the newer request applies that one, and
   *  applying this one first could re-enable collection an Incognito switch just shut. */
  if (desiredDomain !== target) return
  applyDomain(target, enhancedId)
}

const enqueue = () => {
  queue = queue.then(applyLatest).catch((err) => {
    crashlytics().recordError(err instanceof Error ? err : new Error(String(err)))
  })
}

/**
 * The single owner of GA4 identity: which user id is attached, which identifying user
 * properties are set, and whether collection runs. Transitions are serialized and every
 * run applies the latest request, so a slow step (the reset, the per-install id read)
 * can never land an older identity over a newer one.
 */
export const setAnalyticsDomain = (domain: AnalyticsDomain): void => {
  desiredDomain = domain
  if (domain === AnalyticsDomain.Anon) {
    /** Incognito does not wait behind a queued transition. */
    applyDomain(domain, null)
  }
  enqueue()
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
  analytics().setUserProperties(properties)
}
