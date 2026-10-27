/* eslint-disable camelcase */
import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"
import analytics from "@react-native-firebase/analytics"

import { AccountMode } from "@app/types/account"

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
  /** The active self-custodial account's mode; null while custodial is active or the
   *  account has not chosen one. */
  mode: AccountMode | null
  network: SparkNetworkLabel
}

let context: MeasurementContext = { mode: null, network: "mainnet" }

/** Refreshed by TelemetryContextMount whenever the active account or instance changes,
 *  so the gate below works from non-React code (bridge, adapters, executors). */
export const setMeasurementContext = (next: MeasurementContext): void => {
  context = next
}

export const resetMeasurementContext = (): void => {
  context = { mode: null, network: "mainnet" }
}

/**
 * The privacy contract's single choke point: an event leaves the device only for an
 * Enhanced account. Incognito suppresses everything, and so does an unset mode — an
 * account that never recorded a choice (restored wallets can hold none) has not
 * consented to the region posture Enhanced implies, so the gate fails closed.
 *
 * `modeOverride` is for onboarding, where the account being measured is not the active
 * one yet: the caller passes the mode it just wrote, and an Anon choice is honored the
 * moment it is made rather than after activation.
 */
export const measure = (
  event: ScEvent,
  params?: ScEventParams,
  modeOverride?: AccountMode | null,
): void => {
  const mode = modeOverride === undefined ? context.mode : modeOverride
  if (mode !== AccountMode.Enhanced) return
  analytics().logEvent(event, { network: context.network, ...params })
}

/** Settles can be announced more than once (a pending-then-succeeded transition, a
 *  listener re-registered after reconnect), so payment-keyed events dedupe here. The set
 *  is session-scoped: a restarted app that re-announces an old settle overstates by one
 *  announcement, which monthly aggregation tolerates and a persistent ledger of seen
 *  payment ids would not be worth. */
const MEASURED_ONCE_CAP = 1_000
const measuredOnceKeys = new Set<string>()

export const measureOnce = (
  key: string,
  event: ScEvent,
  params?: ScEventParams,
): void => {
  if (measuredOnceKeys.has(key)) return
  if (measuredOnceKeys.size >= MEASURED_ONCE_CAP) {
    const oldest = measuredOnceKeys.values().next().value
    if (oldest !== undefined) measuredOnceKeys.delete(oldest)
  }
  measuredOnceKeys.add(key)
  measure(event, params)
}

export const resetMeasuredOnceKeys = (): void => {
  measuredOnceKeys.clear()
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
): void => {
  /** Telemetry never turns a send into a failure: a response without a payment reports
   *  nothing rather than throwing into the send path. */
  if (!payment) return
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
