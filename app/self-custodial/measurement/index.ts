/* eslint-disable camelcase */
import { type Payment } from "@breeztech/breez-sdk-spark-react-native"

import { ConvertDirection } from "@app/types/payment"
import { reportError } from "@app/utils/error-logging"

import {
  classifyConversionDirection,
  classifyDirection,
  classifyRail,
} from "./classifier"
import {
  EVENT_VERSION,
  MeasurementEvent,
  WalletProvider,
  type DomainEvent,
  type TelemetryPayload,
} from "./contract"
import { deliver } from "./delivery"
import { telemetryEventIdFor } from "./event-id"
import { isSelfCustodialTelemetryPermitted } from "./gate"
import { applyPrivacyPolicy } from "./policy"

/**
 * The single path self-custodial analytics may take (FR-1):
 *
 *   domain event → classifier → privacy policy → delivery adapter
 *
 * Feature code calls the emitters at the bottom of this file and nothing else. It does not
 * see Firebase, does not build payloads, and cannot reach the delivery adapter directly —
 * which is what makes the policy stage unbypassable rather than merely conventional.
 */

const toPayload = (domainEvent: DomainEvent): TelemetryPayload => {
  const base = {
    event_version: EVENT_VERSION[domainEvent.event],
    wallet_provider: domainEvent.walletProvider,
    telemetry_event_id: domainEvent.telemetryEventId,
  }

  switch (domainEvent.event) {
    case MeasurementEvent.PaymentSettled:
      return {
        ...base,
        direction: domainEvent.direction,
        rail_type: domainEvent.railType,
      }
    case MeasurementEvent.ConversionSettled:
      return { ...base, conversion_direction: domainEvent.conversionDirection }
    case MeasurementEvent.ReferralCompleted:
      return base
  }
}

/**
 * Telemetry is never worth a payment. Every public emitter runs inside this, so a fault in
 * classification or delivery is reported and dropped rather than thrown back into the
 * caller — the SDK event listener that counts settlements also drives the wallet refresh,
 * and a throw there would cost the user their balance update to save a metric.
 */
const safely = (what: string, run: () => void): void => {
  try {
    run()
  } catch (err) {
    reportError(`telemetry: ${what}`, err)
  }
}

const emit = (domainEvent: DomainEvent): void => {
  /**
   * The gate first, before a payload is even built. Incognito is not a filter applied to
   * a finished event — nothing about the event is assembled, so there is nothing queued,
   * nothing logged, and nothing to leak if a later stage misbehaves (§5.7, FR-19).
   */
  if (!isSelfCustodialTelemetryPermitted()) return

  const payload = toPayload(domainEvent)
  if (!applyPrivacyPolicy(domainEvent.event, payload).permitted) return

  deliver(domainEvent.event, payload)
}

/**
 * A settled self-custodial payment, in either direction (FR-10).
 *
 * Called for **every** SDK-observed settled receive, not only those arriving at the
 * Lightning Address (FR-11): direct Spark transfers and plain BOLT11 invoices are in
 * scope, and an LNURL-derived count would understate receives by however much the wallet
 * is used without its address.
 *
 * Silently does nothing for a record the classifier will not vouch for — a conversion leg,
 * or a rail the SDK reports as unknown.
 */
export const logPaymentSettled = (payment: Payment): void =>
  safely("payment_settled", () => {
    const railType = classifyRail(payment)
    const direction = classifyDirection(payment)
    if (!railType || !direction) return

    emit({
      event: MeasurementEvent.PaymentSettled,
      walletProvider: WalletProvider.Spark,
      direction,
      railType,
      telemetryEventId: telemetryEventIdFor(payment.id),
    })
  })

/**
 * A completed dollar↔bitcoin swap (FR-12). Carries the direction and no amount: swap
 * volume is gated on OD-2, which is a policy decision rather than an engineering task
 * (FR-15).
 */
export const logConversionSettled = (params: {
  direction: ConvertDirection
  sdkPaymentId: string | null
}): void =>
  safely("conversion_settled", () => {
    emit({
      event: MeasurementEvent.ConversionSettled,
      walletProvider: WalletProvider.Spark,
      conversionDirection: classifyConversionDirection(params.direction),
      telemetryEventId: telemetryEventIdFor(params.sdkPaymentId),
    })
  })

/**
 * An Enhanced user successfully onboarding another user (FR-13).
 *
 * Declared but not yet called: the app has no self-custodial referral surface today — the
 * invite flow behind Circles is custodial and needs an authenticated `me`. The contract
 * lives here so the event is specified when that flow is built; until then the board's
 * Enhanced onboarding tile has no client source and should read as unbuilt, not as zero
 * (FR-61).
 */
export const logReferralCompleted = (params: { sdkPaymentId: string | null }): void =>
  safely("referral_completed", () => {
    emit({
      event: MeasurementEvent.ReferralCompleted,
      walletProvider: WalletProvider.Spark,
      telemetryEventId: telemetryEventIdFor(params.sdkPaymentId),
    })
  })

export {
  getTelemetryMode,
  initializeTelemetryGate,
  isCollectionPermitted,
  isSelfCustodialTelemetryPermitted,
  onTelemetrySuppressed,
  resolveTelemetryMode,
  TelemetryMode,
} from "./gate"
export { getDroppedEventCounts } from "./policy"
export {
  MeasurementEvent,
  RailType,
  TelemetryDirection,
  WalletProvider,
} from "./contract"
