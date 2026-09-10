/* eslint-disable camelcase */
import { EVENT_VERSION, TelemetryEvent, type TelemetryPayload } from "./contract"
import { countUnroutedEvent, reportBoundaryFault } from "./diagnostics"
import type { TelemetryFact } from "./fact"
import { isEventPermitted } from "./mode"
import { drainOutbox, type OutboxStore } from "./outbox"
import { applyPrivacyPolicy } from "./policy"

/**
 * The measurement boundary's only public surface (FR-1, NFR-P5).
 *
 *   TelemetryFact → gate → privacy policy → outbox → TelemetryTransport port
 *
 * Producers construct a `TelemetryFact` and call `captureTelemetryFact`. They never build a
 * payload, never see the outbox and cannot reach the port, which is what makes the policy
 * stage unbypassable rather than merely conventional.
 */

/**
 * The store for the account currently active, mounted by the telemetry provider (AD-14).
 * `null` means there is nowhere to file an event — a custodial session, or the provider not
 * yet mounted — and an event captured then is counted locally and dropped rather than held
 * in memory against an account it may not belong to (AD-20).
 */
let activeOutbox: OutboxStore | null = null

export const setActiveOutbox = (store: OutboxStore | null): void => {
  activeOutbox = store
}

const toPayload = (fact: TelemetryFact): TelemetryPayload => {
  const base = {
    event_version: EVENT_VERSION[fact.event],
    wallet_provider: fact.walletProvider,
    telemetry_event_id: fact.telemetryEventId,
  }

  switch (fact.event) {
    case TelemetryEvent.PaymentSettled:
      return { ...base, direction: fact.direction, rail_type: fact.railType }
    case TelemetryEvent.ConversionSettled:
      return { ...base, conversion_direction: fact.conversionDirection }
    case TelemetryEvent.ReferralCompleted:
      return base
  }
}

/**
 * Files a fact for delivery.
 *
 * The gate runs first, before a payload is even built: suppression is not a filter applied
 * to a finished event — nothing is assembled, so there is nothing queued, nothing logged
 * and nothing to leak if a later stage misbehaves (§5.7, FR-19).
 *
 * `sdkPaymentId` is the local deduplication key and is never transmitted (FR-24). It is a
 * separate argument rather than a field of `TelemetryFact` so that the type crossing the
 * boundary stays exactly the §5.3 allowlist.
 *
 * Nothing here may throw. The settlement listener that emits also drives the wallet
 * refresh, and a throw would cost the user their balance update to save a metric (NFR-R2).
 */
export const captureTelemetryFact = (
  fact: TelemetryFact,
  sdkPaymentId: string | null = null,
): void => {
  try {
    if (!isEventPermitted(fact.event)) return

    const payload = toPayload(fact)
    if (!applyPrivacyPolicy(fact.event, payload).permitted) return

    const store = activeOutbox
    if (!store) {
      countUnroutedEvent()
      return
    }

    store
      .enqueue({
        telemetryEventId: fact.telemetryEventId,
        event: fact.event,
        payload,
        sdkPaymentId,
        queuedAt: Date.now(),
        state: "queued",
      })
      .catch((err) => {
        reportBoundaryFault("outbox enqueue", err)
      })
  } catch (err) {
    reportBoundaryFault("capture", err)
  }
}

/** Drains whichever store is mounted. Safe to call on any trigger; it is a no-op unless the
 *  mode permits draining and a transport is registered. */
export const drainActiveOutbox = async (): Promise<void> => {
  const store = activeOutbox
  if (!store) return
  try {
    await drainOutbox(store)
  } catch (err) {
    reportBoundaryFault("outbox drain", err)
  }
}

export {
  classifyConversionDirection,
  classifyDirection,
  classifyRail,
} from "./classifier"
export {
  isContractEvent,
  RailType,
  TelemetryConversionDirection,
  TelemetryDirection,
  TelemetryEvent,
  TRANSPORT_CONSTRAINTS,
  WalletProvider,
} from "./contract"
export { getDiagnosticCounters, reportBoundaryFault } from "./diagnostics"
export { mintTelemetryEventId } from "./event-id"
export type { TelemetryFact } from "./fact"
export {
  ActiveAccountKind,
  deriveTelemetryMode,
  getTelemetryMode,
  initializeTelemetryGate,
  isDrainPermitted,
  isEventPermitted,
  onTelemetrySuppressed,
  resolveTelemetryMode,
  TelemetryMode,
  type TelemetryModeInputs,
} from "./mode"
// `OutboxRecord` and `OutboxStore` are deliberately absent from this surface: an adapter
// is handed a payload and never a row, which is what keeps the local-only `sdkPaymentId`
// out of its reach (AD-4).
export {
  createOutboxStore,
  getOutboxCounters,
  OUTBOX_MAX_RECORDS,
  OUTBOX_TTL_MS,
} from "./outbox"
export { getDroppedEventCounts } from "./policy"
export { setCustodialAnalyticsIdentity } from "./platform-analytics"
export {
  registerTelemetryTransport,
  type TelemetryTransport,
  type TransportResult,
} from "./transport"
