// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import {
  countMislabelledEvent,
  countSuppressedEvent,
  countUnroutedEvent,
  DiagnosticsModeInput,
  getDiagnosticCounters,
  logDiagnosticBreadcrumb,
  recordDrainStats,
  recordModeResolutionLatency,
  reportBoundaryFault,
  resetDiagnosticsForTesting,
  setDiagnosticsModeInput,
} from "@app/telemetry/diagnostics"

const mockLog = jest.fn()
const mockRecordError = jest.fn()
let mockCrashlyticsUnlinked = false

jest.mock("@react-native-firebase/crashlytics", () => () => {
  if (mockCrashlyticsUnlinked) throw new Error("not installed natively")
  return {
    log: (...args: string[]) => mockLog(...args),
    recordError: (...args: Error[]) => mockRecordError(...args),
    setCrashlyticsCollectionEnabled: () => Promise.resolve(null),
  }
})

/**
 * The boundary's own numbers. None of them is ever transmitted: a non-zero count means a
 * producer or a route is wrong, which is a defect to find in review rather than a figure to
 * report to a board.
 */
describe("the boundary's counters", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCrashlyticsUnlinked = false
    resetDiagnosticsForTesting()
  })

  it("starts at zero", () => {
    expect(getDiagnosticCounters()).toMatchObject({
      suppressedEvents: 0,
      unroutedEvents: 0,
      mislabelledEvents: 0,
      untransmittedFaults: 0,
    })
  })

  it("counts an event the gate refused", () => {
    countSuppressedEvent()
    countSuppressedEvent()

    expect(getDiagnosticCounters().suppressedEvents).toBe(2)
  })

  it("counts an event with no queue to file it in — an emitter running outside its account", () => {
    countUnroutedEvent()

    expect(getDiagnosticCounters().unroutedEvents).toBe(1)
  })

  it("counts a fact whose wallet disagreed with the mode at capture", () => {
    countMislabelledEvent()

    expect(getDiagnosticCounters().mislabelledEvents).toBe(1)
  })

  it("keeps the last drain's numbers, so 'is it draining?' has an answer", () => {
    recordDrainStats({ durationMs: 120, depth: 3, rejected: 1, retryable: 2 })

    expect(getDiagnosticCounters()).toMatchObject({
      lastDrainDurationMs: 120,
      lastDrainDepth: 3,
      drainRejected: 1,
      drainRetryable: 2,
    })
  })

  it("keeps how long the device sat without knowing what it was", () => {
    recordModeResolutionLatency(450)

    expect(getDiagnosticCounters().modeResolutionLatencyMs).toBe(450)
  })

  it("hands out a copy, so a reader cannot move the numbers", () => {
    countSuppressedEvent()
    const snapshot = getDiagnosticCounters() as { suppressedEvents: number }

    snapshot.suppressedEvents = 99

    expect(getDiagnosticCounters().suppressedEvents).toBe(1)
  })
})

describe("the boundary's own breadcrumbs and faults", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCrashlyticsUnlinked = false
    resetDiagnosticsForTesting()
  })

  it("says nothing from a device that may not report, and counts the silence", () => {
    expect(logDiagnosticBreadcrumb("[telemetry] depth=3")).toBe(false)
    reportBoundaryFault("outbox enqueue", new Error("disk full"))

    expect(mockLog).not.toHaveBeenCalled()
    expect(getDiagnosticCounters().untransmittedFaults).toBe(1)
  })

  it("leaves a breadcrumb from a device that may report", () => {
    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

    expect(logDiagnosticBreadcrumb("[telemetry] depth=3")).toBe(true)
    expect(mockLog).toHaveBeenCalledWith("[telemetry] depth=3")
  })

  it("reports a fault from a device that may report", () => {
    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

    reportBoundaryFault("outbox enqueue", new Error("disk full"))

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(getDiagnosticCounters().untransmittedFaults).toBe(0)
  })

  it("counts a breadcrumb the crash SDK could not take, rather than throwing", () => {
    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)
    mockCrashlyticsUnlinked = true

    expect(logDiagnosticBreadcrumb("[telemetry] depth=3")).toBe(false)
    expect(getDiagnosticCounters().untransmittedFaults).toBe(1)
  })
})
