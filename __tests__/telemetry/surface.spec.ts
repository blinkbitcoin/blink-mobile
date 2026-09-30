// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import { resetEnablementForTesting } from "@app/telemetry/enablement"
import * as telemetry from "@app/telemetry"
import * as outbox from "@app/telemetry/outbox"
import {
  DiagnosticsDisposition,
  DiagnosticsModeInput,
  onDiagnosticsDispositionChanged,
  resetTransmissibilityForTesting,
  setDiagnosticsModeInput,
} from "@app/telemetry/transmissibility"
import { resetTelemetryModeForTesting } from "@app/telemetry/mode"
import { resetOutboxCountersForTesting } from "@app/telemetry/outbox/store"

/**
 * The boundary's public surface. Everything the rest of the app is allowed to touch comes
 * through this one module, so what it exports is part of the contract: a rename that
 * compiles here but drops an export would leave a producer reaching past the boundary for
 * it. The checks call each export rather than only naming it, so a broken re-export fails
 * here rather than at a call site months later.
 */
describe("what the rest of the app may reach", () => {
  beforeEach(() => {
    resetTelemetryModeForTesting()
    resetEnablementForTesting()
    resetOutboxCountersForTesting()
    resetTransmissibilityForTesting()
  })

  it("re-exports the outbox's own surface for the boundary to use", () => {
    expect(outbox.createOutboxStore("/mock/documents/barrel").directory).toBe(
      "/mock/documents/barrel",
    )
    expect(outbox.getOutboxCounters()).toHaveProperty("enqueued")
    expect(outbox.sweepCondemnedOutboxes("/mock/documents/barrel")).toBeInstanceOf(
      Promise,
    )
    expect(outbox.drainOutbox).toBeInstanceOf(Function)
    expect(outbox.dedupKeyFor({ sdkPaymentId: null, telemetryEventId: "id" })).toBe(
      "e-id",
    )
    expect(outbox.OutboxState.Queued).toBe("queued")
    expect(outbox.OUTBOX_MAX_RECORDS).toBeGreaterThan(0)
    expect(outbox.OUTBOX_TTL_MS).toBeGreaterThan(0)
    expect(outbox.DRAIN_BACKOFF_INITIAL_MS).toBeGreaterThan(0)
    expect(outbox.DRAIN_BACKOFF_MAX_MS).toBeGreaterThan(0)
    expect(outbox.OUTBOX_SCHEMA_VERSIONS_TOLERATED).toBeGreaterThanOrEqual(1)
    expect(outbox.resetDrainStateForTesting).toBeInstanceOf(Function)
    expect(outbox.resetOutboxCountersForTesting).toBeInstanceOf(Function)
  })

  it("exports the capture surface a producer needs, and nothing it does not", () => {
    expect(typeof telemetry.captureTelemetryFact).toBe("function")
    expect(typeof telemetry.currentWalletProvider).toBe("function")
    expect(typeof telemetry.mintTelemetryEventId).toBe("function")
    // The outbox record type and store internals stay inside: an adapter is handed a
    // payload and never a row, which is what keeps the local-only payment id out of reach.
    expect(telemetry).not.toHaveProperty("dedupKeyFor")
    expect(telemetry).not.toHaveProperty("parseOutboxRecord")
    expect(telemetry).not.toHaveProperty("logPlatformEvent")
    expect(telemetry).not.toHaveProperty("setPlatformCollectionEnabled")
  })

  it("exports the contract, and the table it describes", () => {
    expect(telemetry.CONTRACT.length).toBeGreaterThan(0)
    expect(telemetry.contractRowFor(telemetry.TelemetryEvent.PaymentSettled)).toBeTruthy()
    expect(telemetry.isContractEvent(telemetry.TelemetryEvent.PaymentSettled)).toBe(true)
    expect(telemetry.isContractEvent("something_else")).toBe(false)
    expect(Object.values(telemetry.RailType)).toContain("lightning")
    expect(Object.values(telemetry.EmittingMode)).toContain("enhanced")
    expect(Object.values(telemetry.BackupMethod)).toContain("manual")
    expect(Object.values(telemetry.WalletProvider)).toContain("spark")
    expect(Object.values(telemetry.TelemetryDirection)).toContain("send")
    expect(Object.values(telemetry.TelemetryConversionDirection)).toContain("usd_to_btc")
  })

  it("exports the classifiers the producers use", () => {
    expect(telemetry.classifyDirection).toBeInstanceOf(Function)
    expect(telemetry.classifyRail).toBeInstanceOf(Function)
    expect(
      telemetry.classifyConversionDirection({ fromIsBitcoin: true, toIsBitcoin: false }),
    ).toBe(telemetry.TelemetryConversionDirection.BtcToUsd)
  })

  it("exports the mode surface the provider drives", () => {
    expect(telemetry.getTelemetryMode()).toBe(telemetry.TelemetryMode.Unresolved)
    expect(telemetry.isSuppressedMode(telemetry.TelemetryMode.Anon)).toBe(true)
    expect(telemetry.isSuppressedMode(telemetry.TelemetryMode.Enhanced)).toBe(false)
    expect(
      telemetry.deriveTelemetryMode({
        activeAccount: telemetry.ActiveAccountKind.None,
        persistedMode: null,
        serverMode: null,
        remoteConfigTrusted: true,
        hasSelfCustodialAccount: false,
      }),
    ).toBe(telemetry.TelemetryMode.Custodial)
    expect(telemetry.isEventPermitted(telemetry.TelemetryEvent.PaymentSettled)).toBe(
      false,
    )
    expect(telemetry.isDrainPermitted()).toBe(false)
    expect(telemetry.onTelemetrySuppressed(() => undefined)).toBeInstanceOf(Function)
    expect(telemetry.initializeTelemetryGate()).toBeInstanceOf(Promise)
  })

  it("exports the two switches that sit in front of the gate", () => {
    expect(telemetry.isTelemetryEnabled()).toBe(false)
    telemetry.setTelemetryRolloutEnabled(true)
    expect(telemetry.isTelemetryEnabled()).toBe(true)
    expect(telemetry.isKillSwitchEngaged()).toBe(false)
    expect(telemetry.applyServerKillSwitch(false)).toBe(true)
    expect(telemetry.isKillSwitchEngaged()).toBe(true)
    telemetry.restoreKillSwitch(true)
    expect(telemetry.isKillSwitchEngaged()).toBe(true)
  })

  it("exports the outbox and transport surface the provider and the app wire up", () => {
    expect(telemetry.createOutboxStore("/mock/documents/surface").directory).toBe(
      "/mock/documents/surface",
    )
    expect(telemetry.getOutboxCounters()).toHaveProperty("enqueued")
    expect(telemetry.sweepCondemnedOutboxes("/mock/documents/surface")).toBeInstanceOf(
      Promise,
    )
    expect(telemetry.localOnlyTransport.name).toBe("local-only")
    expect(telemetry.registerTelemetryTransport).toBeInstanceOf(Function)
    expect(telemetry.OUTBOX_MAX_RECORDS).toBeGreaterThan(0)
    expect(telemetry.OUTBOX_TTL_MS).toBeGreaterThan(0)
  })

  it("exports the transport's limits, so a contract test can check the fit", () => {
    expect(telemetry.TRANSPORT_CONSTRAINTS.maxEventNameLength).toBeGreaterThan(0)
    expect(telemetry.TRANSPORT_CONSTRAINTS.maxParametersPerEvent).toBeGreaterThan(0)
    expect(telemetry.TRANSPORT_CONSTRAINTS.maxEventNames).toBeGreaterThan(0)
  })

  it("lets a subscriber stop listening", () => {
    const seen: string[] = []
    const stop = onDiagnosticsDispositionChanged((d) => seen.push(d))

    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)
    stop()
    setDiagnosticsModeInput(DiagnosticsModeInput.Denied)

    expect(seen).toEqual([DiagnosticsDisposition.Permitted])
  })

  it("exports the health and diagnostics readouts", () => {
    expect(telemetry.getTelemetryHealth()).toHaveProperty("enqueued")
    expect(telemetry.getDiagnosticCounters()).toHaveProperty("suppressedEvents")
    expect(telemetry.getDroppedEventCounts()).toHaveProperty("unknown_event")
    expect(telemetry.mayTransmitDiagnostics()).toBe(false)
    expect(() => telemetry.reportBoundaryFault("surface", new Error("x"))).not.toThrow()
  })

  it("exports the custodial identity seam, which only the analytics container calls", () => {
    expect(() =>
      telemetry.setCustodialAnalyticsIdentity({ userId: "ledger-id" }),
    ).not.toThrow()
  })
})
