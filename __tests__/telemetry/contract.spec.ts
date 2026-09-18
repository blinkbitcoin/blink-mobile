/* eslint-disable camelcase */
// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  CONTRACT,
  CONTRACT_VERSION,
  contractRowFor,
  EmittingMode,
  isContractEvent,
  RailType,
  TelemetryConversionDirection,
  TelemetryDirection,
  TelemetryEvent,
  TRANSPORT_CONSTRAINTS,
  WalletProvider,
} from "@app/telemetry/contract"
import { wireNameOf, type TelemetryFact } from "@app/telemetry/fact"

import { renderContractArtifact } from "../../scripts/telemetry-contract"

/**
 * The §5.3 allowlist, transcribed from the PRD rather than from the code, plus the fields
 * the spine has since admitted by name. If a field is added to the contract without being
 * added here, these tests fail — which is the point: NFR-P5 says a reviewer must be able
 * to enumerate everything that can leave the device, and that only holds while the list
 * has a second, independent copy to disagree with.
 */
const PRD_ALLOWLIST = [
  "wallet_provider",
  "direction",
  "rail_type",
  "conversion_direction",
  "telemetry_event_id",
] as const

/** `event_version` is the one documented deviation (FR-14); the rest are AD-24's four
 *  legacy events and AD-31's loss counters, each with a row and a review note. */
const SPINE_ADMITTED = [
  "event_version",
  "backup_method",
  "label",
  "non_custodial_enabled",
  "stable_balance_enabled",
  "has_custodial_account",
  "expired",
  "evicted",
  "rejected",
  "parse_failed",
] as const

/** One fact per row, so the fact union and the table are held in lockstep (Q10). */
const FACT_FOR_ROW: Record<TelemetryEvent, TelemetryFact> = {
  [TelemetryEvent.PaymentSettled]: {
    event: TelemetryEvent.PaymentSettled,
    telemetryEventId: "id",
    walletProvider: "spark",
    direction: "send",
    railType: "lightning",
  },
  [TelemetryEvent.ConversionSettled]: {
    event: TelemetryEvent.ConversionSettled,
    telemetryEventId: "id",
    walletProvider: "spark",
    conversionDirection: "btc_to_usd",
  },
  [TelemetryEvent.ReferralCompleted]: {
    event: TelemetryEvent.ReferralCompleted,
    telemetryEventId: "id",
    walletProvider: "spark",
  },
  [TelemetryEvent.BackupCompleted]: {
    event: TelemetryEvent.BackupCompleted,
    telemetryEventId: "id",
    walletProvider: "custodial",
    backupMethod: "manual",
  },
  [TelemetryEvent.RestoreCompleted]: {
    event: TelemetryEvent.RestoreCompleted,
    telemetryEventId: "id",
    walletProvider: "custodial",
  },
  [TelemetryEvent.StableBalanceActivated]: {
    event: TelemetryEvent.StableBalanceActivated,
    telemetryEventId: "id",
    walletProvider: "custodial",
    label: "USDB",
  },
  [TelemetryEvent.RolloutExposed]: {
    event: TelemetryEvent.RolloutExposed,
    telemetryEventId: "id",
    walletProvider: "custodial",
    nonCustodialEnabled: true,
    stableBalanceEnabled: false,
    hasCustodialAccount: true,
  },
  [TelemetryEvent.LossReported]: {
    event: TelemetryEvent.LossReported,
    telemetryEventId: "id",
    walletProvider: "spark",
    expired: 0,
    evicted: 0,
    rejected: 0,
    parseFailed: 0,
  },
}

describe("the telemetry contract", () => {
  it("lets no row carry a field outside the allowlist", () => {
    const permitted = new Set<string>([...PRD_ALLOWLIST, ...SPINE_ADMITTED])

    for (const row of CONTRACT) {
      for (const field of Object.keys(row.params)) {
        expect({ event: row.event, field, allowed: permitted.has(field) }).toEqual({
          event: row.event,
          field,
          allowed: true,
        })
      }
    }
  })

  it("puts the three common fields on every row", () => {
    for (const row of CONTRACT) {
      expect(Object.keys(row.params)).toEqual(
        expect.arrayContaining([
          "event_version",
          "wallet_provider",
          "telemetry_event_id",
        ]),
      )
    }
  })

  it("keeps each fact variant's keys equal to its row's parameters (AD-1, Q10)", () => {
    for (const row of CONTRACT) {
      const fact = FACT_FOR_ROW[row.event]
      const factWireKeys = Object.keys(fact)
        .filter((key) => key !== "event")
        .map(wireNameOf)
        .concat("event_version")
        .sort()
      expect({ event: row.event, keys: factWireKeys }).toEqual({
        event: row.event,
        keys: Object.keys(row.params).sort(),
      })
    }
  })

  it("holds every field to a closed domain — no free strings (FR-57, FR-73)", () => {
    // The cardinality risk lives in published aggregates, not in the fields — but only
    // because every field is an enumeration, a boolean, a bounded integer or a pinned
    // shape. A free string here would move that risk back onto the device, where no
    // minimum-cell floor can reach it.
    for (const row of CONTRACT) {
      for (const [field, domain] of Object.entries(row.params)) {
        expect({ event: row.event, field, kind: domain.kind }).toMatchObject({
          kind: expect.stringMatching(/^(enum|boolean|count|uuid_v4|schema_version)$/),
        })
        if (domain.kind === "enum") {
          expect(domain.values.length).toBeGreaterThan(0)
          expect(domain.values.length).toBeLessThanOrEqual(4)
        }
      }
    }
    expect(Object.values(WalletProvider)).toHaveLength(2)
    expect(Object.values(TelemetryDirection)).toHaveLength(2)
    expect(Object.values(RailType)).toHaveLength(4)
    expect(Object.values(TelemetryConversionDirection)).toHaveLength(2)
  })

  it("keeps `unknown` as a rail, so a split still sums to the settled total (AD-7)", () => {
    expect(Object.values(RailType)).toContain("unknown")
  })

  describe("AD-24 — the legacy events are ruled on, not silently suppressed", () => {
    it.each([
      { event: TelemetryEvent.BackupCompleted },
      { event: TelemetryEvent.RestoreCompleted },
      { event: TelemetryEvent.StableBalanceActivated },
      { event: TelemetryEvent.RolloutExposed },
    ])("holds $event Custodial-only with its review pending", ({ event }) => {
      const row = contractRowFor(event)
      expect(row?.modes).toEqual([EmittingMode.Custodial])
      expect(row?.review).toMatch(/AD-24/)
    })

    it("lists no mode a row could not emit from", () => {
      for (const row of CONTRACT) {
        for (const mode of row.modes) {
          expect(Object.values(EmittingMode)).toContain(mode)
        }
      }
    })
  })

  describe("AD-23 — the artifact is generated from the table, and the committed copy matches", () => {
    it("matches the committed telemetry-contract.v1.json", () => {
      // `yarn telemetry:contract` regenerates it; `check:telemetry-contract` fails CI when
      // it is stale. This is the same assertion from inside the suite, so a stale artifact
      // cannot ride a green test run.
      const committed = readFileSync(
        resolve(
          __dirname,
          `../../app/telemetry/telemetry-contract.v${CONTRACT_VERSION}.json`,
        ),
        "utf8",
      )
      expect(committed).toBe(renderContractArtifact())
    })

    it("carries every row, with its modes and review note", () => {
      const artifact = JSON.parse(renderContractArtifact()) as {
        events: { name: string; modes: string[]; review?: string }[]
      }
      expect(artifact.events.map((event) => event.name)).toEqual(
        CONTRACT.map((row) => row.event),
      )
      const loss = artifact.events.find(
        (event) => event.name === "telemetry_loss_reported",
      )
      expect(loss?.review).toMatch(/AD-31/)
    })
  })

  describe("FR-63 — the transport's limits constrain the contract, never define it", () => {
    it.each(Object.values(TelemetryEvent).map((event) => ({ event })))(
      "fits $event inside the current transport's name length",
      ({ event }) => {
        expect(event.length).toBeLessThanOrEqual(TRANSPORT_CONSTRAINTS.maxEventNameLength)
      },
    )

    it("fits every event inside the parameter limit", () => {
      for (const row of CONTRACT) {
        expect(Object.keys(row.params).length).toBeLessThanOrEqual(
          TRANSPORT_CONSTRAINTS.maxParametersPerEvent,
        )
      }
    })

    it("stays far inside the event-name budget", () => {
      expect(CONTRACT.length).toBeLessThanOrEqual(TRANSPORT_CONSTRAINTS.maxEventNames)
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
      { event: "conversion_attempt" },
    ])("treats $event as a non-contract event", ({ event }) => {
      expect(isContractEvent(event)).toBe(false)
    })
  })
})
