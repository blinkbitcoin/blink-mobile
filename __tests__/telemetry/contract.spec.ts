/* eslint-disable camelcase */
// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import {
  isContractEvent,
  RailType,
  TelemetryConversionDirection,
  TelemetryDirection,
  TelemetryEvent,
  TRANSPORT_CONSTRAINTS,
  WalletProvider,
} from "@app/telemetry/contract"
import { TELEMETRY_FACT_KEYS } from "@app/telemetry/fact"
import { EVENT_FIELDS } from "@app/telemetry/policy"

/**
 * The §5.3 allowlist, transcribed from the PRD rather than from the code. If a field is
 * added to the contract without being added here, these tests fail — which is the point:
 * NFR-P5 says a reviewer must be able to enumerate everything that can leave the device,
 * and that only holds while the list has a second, independent copy to disagree with.
 *
 * `event_version` is the one documented deviation. It is a constant describing the schema
 * rather than the user, identical on every device (FR-14).
 */
const PRD_ALLOWLIST = [
  "wallet_provider",
  "direction",
  "rail_type",
  "conversion_direction",
  "telemetry_event_id",
] as const

const SCHEMA_FIELDS = ["event_version"] as const

describe("the telemetry contract", () => {
  it("lets no event carry a field outside the §5.3 allowlist", () => {
    const permitted = new Set([...PRD_ALLOWLIST, ...SCHEMA_FIELDS])

    for (const [event, fields] of Object.entries(EVENT_FIELDS)) {
      for (const field of fields) {
        expect({ event, field, allowed: permitted.has(field as never) }).toEqual({
          event,
          field,
          allowed: true,
        })
      }
    }
  })

  it("keeps TelemetryFact's key set equal to the allowlist (AD-1)", () => {
    // `event` is the discriminant rather than a payload field; everything else is the
    // camelCase spelling of an allowlisted name.
    expect([...TELEMETRY_FACT_KEYS].sort()).toEqual(
      [
        "conversionDirection",
        "direction",
        "event",
        "railType",
        "telemetryEventId",
        "walletProvider",
      ].sort(),
    )
  })

  it("holds every allowlisted field to a closed value domain (FR-73)", () => {
    // The cardinality risk lives in published aggregates, not in the fields — but only
    // because every field is an enumeration of at most four values. A free string here
    // would move that risk back onto the device, where no minimum-cell floor can reach it.
    expect(Object.values(WalletProvider)).toHaveLength(2)
    expect(Object.values(TelemetryDirection)).toHaveLength(2)
    expect(Object.values(RailType)).toHaveLength(4)
    expect(Object.values(TelemetryConversionDirection)).toHaveLength(2)
  })

  it("keeps `unknown` as a rail, so a split still sums to the settled total (AD-7)", () => {
    expect(Object.values(RailType)).toContain("unknown")
  })

  describe("FR-63 — the transport's limits constrain the contract, never define it", () => {
    it.each(Object.values(TelemetryEvent).map((event) => ({ event })))(
      "fits $event inside the current transport's name length",
      ({ event }) => {
        expect(event.length).toBeLessThanOrEqual(TRANSPORT_CONSTRAINTS.maxEventNameLength)
      },
    )

    it("fits every event inside the parameter limit", () => {
      for (const fields of Object.values(EVENT_FIELDS)) {
        expect(fields.length).toBeLessThanOrEqual(
          TRANSPORT_CONSTRAINTS.maxParametersPerEvent,
        )
      }
    })

    it("stays far inside the event-name budget", () => {
      expect(Object.values(TelemetryEvent).length).toBeLessThanOrEqual(
        TRANSPORT_CONSTRAINTS.maxEventNames,
      )
    })
  })

  describe("the contract-event axis of the gate (FR-70)", () => {
    it.each(Object.values(TelemetryEvent).map((event) => ({ event })))(
      "recognises $event",
      ({ event }) => {
        expect(isContractEvent(event)).toBe(true)
      },
    )

    it.each([
      { event: "screen_view" },
      { event: "session_start" },
      { event: "first_open" },
      { event: "self_custodial_backup_completed" },
      { event: "conversion_attempt" },
    ])("treats $event as a non-contract event", ({ event }) => {
      expect(isContractEvent(event)).toBe(false)
    })
  })
})
