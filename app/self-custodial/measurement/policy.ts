/* eslint-disable camelcase */
import {
  MeasurementEvent,
  RailType,
  TelemetryConversionDirection,
  TelemetryDirection,
  WalletProvider,
  type TelemetryPayload,
} from "./contract"

/**
 * The privacy policy stage. Every payload passes through here before it can reach a
 * delivery adapter; a payload that fails is dropped and counted, never trimmed and sent
 * (FR-7). Dropping rather than sanitising is deliberate — a payload carrying a field
 * nobody declared is evidence the classifier is wrong, and a sanitised send would hide it.
 *
 * Two checks, because they catch different mistakes (addendum A2.4):
 *
 *  - **Unknown key** catches a *new* field appearing without review.
 *  - **Value domain** catches a *prohibited value* smuggled through an *allowed* field —
 *    a `rail_type` carrying a hashed destination, a `telemetry_event_id` that is really a
 *    payment hash. This is the half FR-57 exists for, and the half an allowlist alone
 *    misses.
 */

/**
 * `telemetry_event_id` is the only free-form-looking field in the contract, so its shape
 * is pinned rather than trusted. A random v4 UUID matches; a 64-hex payment hash, a
 * 66-hex compressed pubkey and a base64 digest all do not. That is what stops the single
 * string field in the payload from becoming the hole the derivation rule warns about.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isOneOf = (allowed: readonly string[]) => (value: unknown) =>
  typeof value === "string" && allowed.includes(value)

const FIELD_VALIDATORS: Record<string, (value: unknown) => boolean> = {
  wallet_provider: isOneOf(Object.values(WalletProvider)),
  direction: isOneOf(Object.values(TelemetryDirection)),
  rail_type: isOneOf(Object.values(RailType)),
  conversion_direction: isOneOf(Object.values(TelemetryConversionDirection)),
  telemetry_event_id: (value) => typeof value === "string" && UUID_V4.test(value),
  event_version: (value) =>
    typeof value === "number" && Number.isInteger(value) && value > 0,
}

/**
 * Exactly which fields each event carries. Held per-event rather than as one flat
 * allowlist so a `payment_settled` cannot arrive bearing `conversion_direction`: a field
 * that is legitimate elsewhere is still unexplained here, and an unexplained field is the
 * shape a leak takes.
 */
const EVENT_FIELDS: Record<MeasurementEvent, readonly string[]> = {
  [MeasurementEvent.PaymentSettled]: [
    "event_version",
    "wallet_provider",
    "direction",
    "rail_type",
    "telemetry_event_id",
  ],
  [MeasurementEvent.ConversionSettled]: [
    "event_version",
    "wallet_provider",
    "conversion_direction",
    "telemetry_event_id",
  ],
  [MeasurementEvent.ReferralCompleted]: [
    "event_version",
    "wallet_provider",
    "telemetry_event_id",
  ],
}

export const PolicyRejection = {
  UnknownEvent: "unknown_event",
  UnknownField: "unknown_field",
  MissingField: "missing_field",
  InvalidValue: "invalid_value",
} as const

export type PolicyRejection = (typeof PolicyRejection)[keyof typeof PolicyRejection]

export type PolicyVerdict =
  | { permitted: true }
  | { permitted: false; rejection: PolicyRejection; field?: string }

/**
 * Local, never transmitted (FR-7). A non-zero count means the classifier is emitting
 * something the contract does not describe, which is a defect to be found in review
 * rather than a number to be reported to the board.
 */
const droppedCounts: Record<PolicyRejection, number> = {
  [PolicyRejection.UnknownEvent]: 0,
  [PolicyRejection.UnknownField]: 0,
  [PolicyRejection.MissingField]: 0,
  [PolicyRejection.InvalidValue]: 0,
}

export const getDroppedEventCounts = (): Readonly<Record<PolicyRejection, number>> => ({
  ...droppedCounts,
})

export const resetDroppedEventCountsForTesting = (): void => {
  for (const key of Object.keys(droppedCounts) as PolicyRejection[]) {
    droppedCounts[key] = 0
  }
}

const reject = (rejection: PolicyRejection, field?: string): PolicyVerdict => {
  droppedCounts[rejection] += 1
  return { permitted: false, rejection, field }
}

export const applyPrivacyPolicy = (
  event: string,
  payload: TelemetryPayload,
): PolicyVerdict => {
  const allowedFields = EVENT_FIELDS[event as MeasurementEvent]
  if (!allowedFields) return reject(PolicyRejection.UnknownEvent)

  for (const key of Object.keys(payload)) {
    if (!allowedFields.includes(key)) return reject(PolicyRejection.UnknownField, key)
    if (!FIELD_VALIDATORS[key](payload[key])) {
      return reject(PolicyRejection.InvalidValue, key)
    }
  }

  /** A missing field is as much a contract breach as an extra one: a partial event
   *  silently changes what a board count means. */
  for (const key of allowedFields) {
    if (!(key in payload)) return reject(PolicyRejection.MissingField, key)
  }

  return { permitted: true }
}
