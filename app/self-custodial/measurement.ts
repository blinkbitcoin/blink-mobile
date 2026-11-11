/* eslint-disable camelcase */
import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"
import analytics from "@react-native-firebase/analytics"

import { AccountMode } from "@app/types/account"

import {
  isEnhancedIdentityApplied,
  onEnhancedIdentityApplied,
} from "./analytics-identity"
import type { SparkNetworkLabel } from "./config"

/**
 * The rails reported for self-custodial payments. Sends split Lightning finely (BOLT11
 * vs LNURL-pay); SDK-observed settles keep the coarse `lightning`, since a settled
 * payment's method does not say which of the two carried it, and Lightning Address is a
 * receive-side variant. A rail is a category, never an identifier: the destination and
 * the counterparty never appear.
 */
export const ScRail = {
  Lightning: "lightning",
  Bolt11: "bolt11",
  LnurlPay: "lnurl_pay",
  Spark: "spark",
  Onchain: "onchain",
  LightningAddress: "lightning_address",
} as const

export type ScRail = (typeof ScRail)[keyof typeof ScRail]

/** The rail an SDK-settled payment traveled, read from its method. Token transfers are
 *  Spark transfers (USDB rides Spark), deposits and withdrawals are the onchain legs.
 *  Unknown reports nothing: an unlabeled rail would quietly distort the per-rail counts. */
export const scRailForPaymentMethod = (method: PaymentMethod): ScRail | null => {
  switch (method) {
    case PaymentMethod.Lightning:
      return ScRail.Lightning
    case PaymentMethod.Spark:
    case PaymentMethod.Token:
      return ScRail.Spark
    case PaymentMethod.Deposit:
    case PaymentMethod.Withdraw:
      return ScRail.Onchain
    default:
      return null
  }
}

/** Every self-custodial telemetry event. New names stay under GA4's 40-character limit
 *  and keep the `sc_` prefix so Enhanced activity is one filter away from custodial's;
 *  the three legacy `self_custodial_*` names predate the gate and keep theirs so
 *  existing dashboards do not break. */
export const ScEvent = {
  AccountCreated: "sc_account_created",
  AccountModeSelected: "sc_account_mode_selected",
  AccountModeChanged: "sc_account_mode_changed",
  LightningAddressRegistered: "sc_lightning_address_registered",
  BackupCompleted: "self_custodial_backup_completed",
  RestoreCompleted: "self_custodial_restore_completed",
  StableBalanceActivated: "self_custodial_stable_balance_activated",
  PaymentDestinationParsed: "sc_payment_destination_parsed",
  PaymentSendInitiated: "sc_payment_send_initiated",
  PaymentSendSettled: "sc_payment_send_settled",
  PaymentSendFailed: "sc_payment_send_failed",
  PaymentRequestCreated: "sc_payment_request_created",
  PaymentReceived: "sc_payment_received",
  SwapQuoteShown: "sc_swap_quote_shown",
  SwapCompleted: "sc_swap_completed",
  SwapFailed: "sc_swap_failed",
  BlinkPaymentSent: "sc_blink_payment_sent",
} as const

export type ScEvent = (typeof ScEvent)[keyof typeof ScEvent]

/** Closed enums and booleans only: never amounts, balances, pubkeys, invoices,
 *  destinations, or free text. */
export type ScEventParams = Record<string, string | number | boolean>

type MeasurementContext = {
  /** The active self-custodial account; null while custodial is active. */
  accountId: string | null
  /** The active self-custodial account's mode; null while custodial is active or the
   *  account has not chosen one. */
  mode: AccountMode | null
  network: SparkNetworkLabel
}

const EMPTY_CONTEXT: MeasurementContext = {
  accountId: null,
  mode: null,
  network: "mainnet",
}

let context: MeasurementContext = EMPTY_CONTEXT
/** Bumped whenever the account, its mode or the network changes: work begun under one
 *  context (a send awaiting its outcome, an event waiting to be delivered) is never
 *  reported under another. */
let generation = 0

const isSameContext = (a: MeasurementContext, b: MeasurementContext) =>
  a.accountId === b.accountId && a.mode === b.mode && a.network === b.network

/**
 * Whose an event is, which decides when it may be delivered and when it is dropped
 * instead. Most events belong to the context they were measured in. An onboarding event
 * belongs to an account that is not active, or not Enhanced, yet: it waits for that
 * account to become active under Enhanced and then belongs to that context.
 */
type Owner =
  | { kind: "generation"; generation: number }
  | { kind: "account"; accountId: string }

type DeliveryHooks = { onDelivered?: () => void; onDropped?: () => void }

type Delivery = {
  owner: Owner
  event: ScEvent
  payload: ScEventParams
  hooks: DeliveryHooks
  queuedAtMs: number
}

/** Long enough for an onboarding to reach activation; an onboarding left unfinished is
 *  not reported against whatever Enhanced session comes much later. */
const PENDING_DELIVERY_TTL_MS = 5 * 60 * 1000
const PENDING_DELIVERY_CAP = 50
let pendingDeliveries: Delivery[] = []

const send = ({ event, payload, hooks }: Delivery) => {
  Promise.resolve(analytics().logEvent(event, payload)).then(
    () => hooks.onDelivered?.(),
    () => hooks.onDropped?.(),
  )
}

/** Ready when it belongs to the context in effect and GA4 is fully under the Enhanced
 *  identity: separated from the custodial account, the per-install id attached, and
 *  collection on. */
const isDeliverable = (owner: Owner) =>
  owner.kind === "generation" &&
  owner.generation === generation &&
  isEnhancedIdentityApplied()

const flushPendingDeliveries = () => {
  const now = Date.now()
  const waiting: Delivery[] = []
  pendingDeliveries.forEach((delivery) => {
    if (now - delivery.queuedAtMs > PENDING_DELIVERY_TTL_MS) {
      delivery.hooks.onDropped?.()
    } else if (isDeliverable(delivery.owner)) {
      send(delivery)
    } else {
      waiting.push(delivery)
    }
  })
  pendingDeliveries = waiting
}

onEnhancedIdentityApplied(flushPendingDeliveries)

const deliver = (delivery: Omit<Delivery, "queuedAtMs">) => {
  if (isDeliverable(delivery.owner)) {
    send({ ...delivery, queuedAtMs: Date.now() })
    return
  }
  if (pendingDeliveries.length >= PENDING_DELIVERY_CAP) {
    pendingDeliveries.shift()?.hooks.onDropped?.()
  }
  pendingDeliveries.push({ ...delivery, queuedAtMs: Date.now() })
}

/** Moves every waiting event onto the context that just began: those of the context that
 *  ended are dropped, and an onboarding event joins its account's context once that
 *  account is active under Enhanced (or is dropped if it turns out Incognito). */
const rehomePendingDeliveries = (next: MeasurementContext) => {
  pendingDeliveries = pendingDeliveries.filter((delivery) => {
    const { owner } = delivery
    if (owner.kind === "generation" || owner.accountId !== next.accountId) {
      const isStale = owner.kind === "generation"
      if (isStale) delivery.hooks.onDropped?.()
      return !isStale
    }
    if (next.mode === AccountMode.Enhanced) {
      delivery.owner = { kind: "generation", generation }
      return true
    }
    /** No mode yet: the choice may be about to land, so the event keeps waiting. */
    if (next.mode === null) return true
    delivery.hooks.onDropped?.()
    return false
  })
}

/** Refreshed by TelemetryContextMount whenever the active account or instance changes,
 *  so the gate below works from non-React code (bridge, adapters, executors). */
export const setMeasurementContext = (next: MeasurementContext): void => {
  if (isSameContext(context, next)) return
  context = next
  generation += 1
  /** Outcomes still owed belong to the context that is ending; none crosses over. */
  awaitingOutcome.clear()
  observedOutcomes.clear()
  rehomePendingDeliveries(next)
  flushPendingDeliveries()
}

export const resetMeasurementContext = (): void => {
  setMeasurementContext(EMPTY_CONTEXT)
}

/** The context an operation starts in, to hand back when it reports how it ended. */
export const measurementGeneration = (): number => generation

const emit = (
  owner: Owner,
  { event, params }: MeasuredEvent,
  hooks: DeliveryHooks = {},
) => {
  deliver({ owner, event, payload: { network: context.network, ...params }, hooks })
}

/**
 * The privacy contract's single choke point: an event leaves the device only for an
 * Enhanced account. Incognito suppresses everything, and so does an unset mode — an
 * account that never recorded a choice (restored wallets can hold none) has not
 * consented to the region posture Enhanced implies, so the gate fails closed.
 *
 * Consent decides whether an event may be sent; delivery then waits for GA4 to be fully
 * under the Enhanced identity, and drops the event if its context ends first.
 */
export const measure = (event: ScEvent, params?: ScEventParams): boolean => {
  if (context.mode !== AccountMode.Enhanced) return false
  emit({ kind: "generation", generation }, { event, params })
  return true
}

/** The account an onboarding or mode-switch event is about, and the mode it was just
 *  given: the account need not be active, or Enhanced, yet. */
export type MeasureTarget = { accountId: string; mode: AccountMode | null }

/**
 * For onboarding and mode switches, where the account measured is not the active one
 * yet, or is but has not taken its new mode: an Incognito choice is honoured the moment
 * it is made, and an Enhanced one is delivered only once that account is active under
 * Enhanced — never under the custodial identity, or another account's.
 */
export const measureFor = (
  target: MeasureTarget,
  event: ScEvent,
  params?: ScEventParams,
): boolean => {
  if (target.mode !== AccountMode.Enhanced) return false
  const isInEffect =
    target.accountId === context.accountId && context.mode === AccountMode.Enhanced
  emit(
    isInEffect
      ? { kind: "generation", generation }
      : { kind: "account", accountId: target.accountId },
    { event, params },
  )
  return true
}

/** For the end of an operation begun in `startedIn`: reported only if that context is
 *  still the one in effect, so a rejection that arrives after a switch is not attributed
 *  to the account, mode or network that followed. */
export const measureIn = (
  startedIn: number,
  event: ScEvent,
  params?: ScEventParams,
): boolean => startedIn === generation && measure(event, params)

/** Settles can be announced more than once (a pending-then-succeeded transition, a
 *  listener re-registered after reconnect), so payment-keyed events dedupe here. The set
 *  is session-scoped: a restarted app that re-announces an old settle overstates by one
 *  announcement, which monthly aggregation tolerates and a persistent ledger of seen
 *  payment ids would not be worth. */
const MEASURED_ONCE_CAP = 1_000
const deliveredKeys = new Set<string>()
/** Keys of events accepted but not yet delivered: held so a second announcement does not
 *  count twice, and released if the event is dropped rather than delivered. */
const reservedKeys = new Set<string>()

const commitKey = (key: string) => {
  reservedKeys.delete(key)
  if (deliveredKeys.size >= MEASURED_ONCE_CAP) {
    const oldest = deliveredKeys.values().next().value
    if (oldest !== undefined) deliveredKeys.delete(oldest)
  }
  deliveredKeys.add(key)
}

export const measureOnce = (
  key: string,
  event: ScEvent,
  params?: ScEventParams,
): void => {
  if (deliveredKeys.has(key) || reservedKeys.has(key)) return
  if (context.mode !== AccountMode.Enhanced) return
  /** A key is used up only by an event GA4 accepted: one that expires, is evicted, is
   *  dropped with its context, or is rejected leaves a later announcement free to
   *  count. */
  reservedKeys.add(key)
  emit(
    { kind: "generation", generation },
    { event, params },
    {
      onDelivered: () => commitKey(key),
      onDropped: () => reservedKeys.delete(key),
    },
  )
}

export const resetMeasuredOnceKeys = (): void => {
  deliveredKeys.clear()
  reservedKeys.clear()
}

/** The error code a send or swap reports when the SDK announces its failure after the
 *  call that dispatched it had already returned: there is no error object to classify. */
export const SETTLEMENT_FAILED_CODE = "sc_settlement_failed"

type MeasuredEvent = { event: ScEvent; params?: ScEventParams }

/** What a dispatched payment reports once its outcome is known: every event in
 *  `settled` on completion, `failed` (with an error code) on failure. */
export type SettlementTelemetry = {
  settled: ReadonlyArray<MeasuredEvent>
  failed: MeasuredEvent
}

type TerminalStatus = PaymentStatus.Completed | PaymentStatus.Failed

/** Bounded like the dedupe set; a payment that never resolves (an app killed mid-send,
 *  an SDK that suppresses its event) is dropped, never counted. */
const SETTLEMENT_TRACK_CAP = 200
const awaitingOutcome = new Map<string, SettlementTelemetry>()
const observedOutcomes = new Map<string, TerminalStatus>()

const remember = <V>(map: Map<string, V>, key: string, value: V) => {
  if (map.size >= SETTLEMENT_TRACK_CAP) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  map.set(key, value)
}

const emitOutcome = (
  paymentId: string,
  status: TerminalStatus,
  telemetry: SettlementTelemetry,
) => {
  if (status === PaymentStatus.Completed) {
    telemetry.settled.forEach(({ event, params }) =>
      measureOnce(`${paymentId}:${event}`, event, params),
    )
    return
  }
  const { event, params } = telemetry.failed
  measureOnce(`${paymentId}:${event}`, event, {
    ...params,
    error_code: SETTLEMENT_FAILED_CODE,
  })
}

/**
 * Reports a send or swap by what the SDK says happened to it, not by the call returning:
 * `sendPayment` hands a payment back as soon as it is dispatched (a BOLT11 send waits for
 * nothing, an onchain one is only broadcast), so a pending payment is held until the
 * SDK's own success or failure event for it arrives through `measureObservedPayment`.
 * That event can also beat the call's return, so an outcome seen first is kept too.
 */
export const measureSettlement = (
  payment: Pick<Payment, "id" | "status"> | undefined,
  telemetry: SettlementTelemetry,
  startedIn: number,
): void => {
  /** Telemetry never turns a send into a failure: a response without a payment reports
   *  nothing rather than throwing into the send path. */
  if (!payment) return
  /** Begun under another account, mode or network (an Incognito send that returns after
   *  a switch to Enhanced), or under a mode that reports nothing: never registered, so it
   *  can never be reported later under the context that followed. */
  if (startedIn !== generation || context.mode !== AccountMode.Enhanced) return
  if (payment.status !== PaymentStatus.Pending) {
    emitOutcome(payment.id, payment.status, telemetry)
    return
  }
  const observed = observedOutcomes.get(payment.id)
  if (observed !== undefined) {
    observedOutcomes.delete(payment.id)
    emitOutcome(payment.id, observed, telemetry)
    return
  }
  remember(awaitingOutcome, payment.id, telemetry)
}

/**
 * A payment the SDK announced, whichever screen was up — and none need have been, for
 * payments that landed while the app was away. A completed receive is a settle the
 * wallet observed (railed coarsely: a settled payment's method does not tell BOLT11 from
 * LNURL-pay); a send's terminal status resolves the send that dispatched it.
 */
export const measureObservedPayment = (payment: Payment): void => {
  const { id, status, paymentType } = payment
  if (status === PaymentStatus.Pending) return

  if (paymentType === PaymentType.Receive) {
    if (status !== PaymentStatus.Completed) return
    const rail = scRailForPaymentMethod(payment.method)
    if (rail) measureOnce(id, ScEvent.PaymentReceived, { rail })
    return
  }

  const awaiting = awaitingOutcome.get(id)
  if (awaiting) {
    awaitingOutcome.delete(id)
    emitOutcome(id, status, awaiting)
    return
  }
  remember(observedOutcomes, id, status)
}

export const resetSettlementTracking = (): void => {
  awaitingOutcome.clear()
  observedOutcomes.clear()
}
