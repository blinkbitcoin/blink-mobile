// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

const mockSetCollectionEnabled = jest.fn()
const mockClearIdentity = jest.fn()
const mockSetIdentityPermitted = jest.fn()

jest.mock("@app/telemetry/platform-analytics", () => ({
  setPlatformCollectionEnabled: (...args: unknown[]) => mockSetCollectionEnabled(...args),
  clearCustodialAnalyticsIdentity: (...args: unknown[]) => mockClearIdentity(...args),
  setCustodialIdentityPermitted: (...args: unknown[]) =>
    mockSetIdentityPermitted(...args),
}))

import {
  getDiagnosticCounters,
  resetDiagnosticsForTesting,
} from "@app/telemetry/diagnostics"
import {
  getTelemetryMode,
  initializeTelemetryGate,
  resetTelemetryModeForTesting,
  resolveTelemetryMode,
  TelemetryMode,
  whenModeSettled,
} from "@app/telemetry/mode"

/**
 * The gate runs at module scope while the bundle is still evaluating, so a platform seam
 * that fails there would be an unhandled throw with no screen to show it on. The seam
 * itself swallows its own failures; this covers the layer above, for the case where even
 * that gives way.
 */
describe("a platform seam that throws where nothing can catch it", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetTelemetryModeForTesting()
    resetDiagnosticsForTesting()
    mockSetCollectionEnabled.mockImplementation(() => {
      throw new Error("native module not linked")
    })
  })

  it("still initialises the gate, and counts the failure instead of raising it", async () => {
    await expect(initializeTelemetryGate()).resolves.toBeUndefined()

    expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved)
    expect(getDiagnosticCounters().untransmittedFaults).toBeGreaterThan(0)
  })

  it("still resolves a mode, and leaves the transition chain usable", async () => {
    await expect(resolveTelemetryMode(TelemetryMode.Anon)).resolves.toBeUndefined()
    await expect(whenModeSettled()).resolves.toBeUndefined()

    expect(getTelemetryMode()).toBe(TelemetryMode.Anon)
  })

  it("keeps transitioning once the seam works again", async () => {
    await resolveTelemetryMode(TelemetryMode.Anon)
    mockSetCollectionEnabled.mockImplementation(() => undefined)

    await resolveTelemetryMode(TelemetryMode.Custodial)
    await whenModeSettled()

    expect(mockSetCollectionEnabled).toHaveBeenLastCalledWith(true)
  })

  it("does not let a failure on the way out stop the discard on the way in", async () => {
    const discarded: string[] = []
    await resolveTelemetryMode(TelemetryMode.Enhanced)
    const { onTelemetrySuppressed } = await import("@app/telemetry/mode")
    onTelemetrySuppressed(() => {
      discarded.push("discard")
    })

    await resolveTelemetryMode(TelemetryMode.Anon)

    expect(discarded).toEqual(["discard"])
  })
})
