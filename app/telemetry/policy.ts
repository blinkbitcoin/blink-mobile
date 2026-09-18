import {
  contractRowFor,
  type ContractRow,
  type ParamDomain,
  type TelemetryPayload,
} from "./contract"

/**
 * The privacy policy stage. Every payload passes through here before it can reach the
 * outbox or the platform SDK; a payload that fails is dropped and counted, never trimmed
 * and sent (FR-7). Dropping rather than sanitising is deliberate — a payload carrying a
 * field nobody declared is evidence the producer is wrong, and a sanitised send would hide
 * it.
 *
 * The checks read the contract table (AD-23) and nothing else, so a parameter that is not
 * in a row cannot pass, and a value outside a row's domain cannot pass. Those are two
 * different mistakes (addendum A2.4): an unknown key catches a *new* field appearing
 * without review; the domain check catches a *prohibited value* smuggled through an
 * *allowed* field — a `rail_type` carrying a hashed destination, a `telemetry_event_id`
 * that is really a payment hash. The second is the half FR-57 exists for.
 */

/**
 * `telemetry_event_id` is the only free-form-looking field in the contract, so its shape is
 * pinned rather than trusted. A random v4 UUID matches; a 64-hex payment hash, a 66-hex
 * compressed pubkey and a base64 digest all do not. That check is what stops the single
 * string field in the payload from becoming the hole the derivation rule warns about.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_COUNT = 1_000_000

const satisfies = (domain: ParamDomain, value: unknown): boolean => {
  switch (domain.kind) {
    case "enum":
      return typeof value === "string" && domain.values.includes(value)
    case "boolean":
      return typeof value === "boolean"
    case "count":
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= MAX_COUNT
      )
    case "uuid_v4":
      return typeof value === "string" && UUID_V4.test(value)
    case "schema_version":
      return typeof value === "number" && Number.isInteger(value) && value > 0
  }
}

export const PolicyRejection = {
  UnknownEvent: "unknown_event",
  UnknownField: "unknown_field",
  MissingField: "missing_field",
  InvalidValue: "invalid_value",
} as const

export type PolicyRejection = (typeof PolicyRejection)[keyof typeof PolicyRejection]

export type PolicyVerdict =
  | { permitted: true; row: ContractRow }
  | { permitted: false; rejection: PolicyRejection; field?: string }

/**
 * Local, never transmitted (FR-7, AD-13). A non-zero count means a producer is emitting
 * something the contract does not describe, which is a defect to be found in review rather
 * than a number to be reported to a board.
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
  const row = contractRowFor(event)
  if (!row) return reject(PolicyRejection.UnknownEvent)

  for (const key of Object.keys(payload)) {
    const domain = row.params[key]
    if (!domain) return reject(PolicyRejection.UnknownField, key)
    if (!satisfies(domain, payload[key])) return reject(PolicyRejection.InvalidValue, key)
  }

  /** A missing field is as much a contract breach as an extra one: a partial event
   *  silently changes what a board count means. */
  for (const key of Object.keys(row.params)) {
    if (!(key in payload)) return reject(PolicyRejection.MissingField, key)
  }

  return { permitted: true, row }
}
