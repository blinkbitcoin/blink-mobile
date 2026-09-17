// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import { NativeModules } from "react-native"

import {
  DiagnosticsModeInput,
  resetTransmissibilityForTesting,
  setDiagnosticsModeInput,
  setSelfCustodialDiagnosticsShutdown,
} from "@app/telemetry/transmissibility"
import { reportError } from "@app/utils/error-logging"
import {
  ErrorReportClass,
  classifyError,
  isConnectivityError,
  logBreadcrumb,
  recordAppError,
  resetErrorReportingForTesting,
  toError,
} from "@app/utils/error-reporting"

const mockLog = jest.fn()
const mockRecordError = jest.fn()
const mockSetCollectionEnabled = jest.fn((_enabled: boolean) => Promise.resolve(null))
const mockNativeSetDisposition = jest.fn((_permitted: boolean) => undefined)

/** RNFB's `crashlytics()` throws synchronously when the native module is not linked. */
let mockCrashlyticsUnlinked = false

jest.mock("@react-native-firebase/crashlytics", () => () => {
  if (mockCrashlyticsUnlinked) {
    throw new Error(
      "You attempted to use a Firebase module that's not installed natively",
    )
  }
  return {
    log: (...args: string[]) => mockLog(...args),
    recordError: (...args: Error[]) => mockRecordError(...args),
    setCrashlyticsCollectionEnabled: (enabled: boolean) =>
      mockSetCollectionEnabled(enabled),
  }
})
NativeModules.CrashCollection = {
  setCrashCollectionDisposition: (permitted: boolean) =>
    mockNativeSetDisposition(permitted),
}

const loadFreshErrorReportingModule = () => {
  let mod: typeof import("@app/utils/error-reporting") | undefined
  jest.isolateModules(() => {
    mod = require("@app/utils/error-reporting")
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const gate: typeof import("@app/telemetry/transmissibility") = require("@app/telemetry/transmissibility")
    gate.setDiagnosticsModeInput(gate.DiagnosticsModeInput.Custodial)
  })
  return mod!
}

describe("isConnectivityError", () => {
  const CONNECTIVITY_MESSAGES: ReadonlyArray<{ label: string; message: string }> = [
    {
      label: "gRPC Unavailable",
      message:
        'Failed to subscribe to server events: Status { code: Unavailable, message: "dns error" }',
    },
    { label: "bare gRPC status", message: "status: Code: Unavailable" },
    { label: "HTTP 503 text", message: "Drive upload failed (503): Service Unavailable" },
    { label: "FCM service", message: "SERVICE_NOT_AVAILABLE" },
    {
      label: "dns error",
      message: "transport error: dns error: failed to lookup address",
    },
    { label: "transport error", message: "transport error: connection refused" },
    { label: "FCM timeout", message: "java.io.IOException: TIMEOUT" },
    { label: "generic timeout", message: "Request timed out after 30s" },
    { label: "Apollo network failure", message: "Network request failed" },
    { label: "network down", message: "network down" },
    { label: "fetch failure", message: "TypeError: Failed to fetch" },
    { label: "connection reset", message: "connection reset by peer" },
    { label: "socket", message: "socket hang up" },
    { label: "abort", message: "Aborted" },
    { label: "errno code", message: "connect ECONNREFUSED 127.0.0.1:443" },
    { label: "iOS offline", message: "The Internet connection appears to be offline." },
  ]

  CONNECTIVITY_MESSAGES.forEach(({ label, message }) => {
    it(`matches ${label}`, () => {
      expect(isConnectivityError(new Error(message))).toBe(true)
    })
  })

  it("matches on error name as well as message", () => {
    const err = new Error("something broke")
    err.name = "NetworkError"
    expect(isConnectivityError(err)).toBe(true)
  })

  it("matches non-Error values by their string form", () => {
    expect(isConnectivityError("dns error while polling")).toBe(true)
  })

  it("does not match ordinary defect messages", () => {
    expect(
      isConnectivityError(new Error("Cannot read property 'foo' of undefined")),
    ).toBe(false)
    expect(isConnectivityError(new Error("Unknown token payment dropped"))).toBe(false)
    expect(isConnectivityError(new Error("Quarantine write failed for key x"))).toBe(
      false,
    )
  })

  it("does not treat storage-layer 'unavailable' as connectivity", () => {
    expect(isConnectivityError(new Error("AsyncStorage unavailable"))).toBe(false)
  })
})

describe("classifyError", () => {
  it("classifies pattern-matched errors as transient", () => {
    expect(classifyError(new Error("dns error"))).toBe(ErrorReportClass.Transient)
  })

  it("classifies unmatched errors as defects", () => {
    expect(classifyError(new Error("assertion failed"))).toBe(ErrorReportClass.Defect)
  })

  it("expected wins over pattern matching", () => {
    expect(classifyError(new Error("dns error"), { expected: true })).toBe(
      ErrorReportClass.Expected,
    )
  })

  it("alwaysRecord beats pattern matching", () => {
    expect(classifyError(new Error("dns error"), { alwaysRecord: true })).toBe(
      ErrorReportClass.Defect,
    )
  })

  it("expected wins over alwaysRecord", () => {
    expect(
      classifyError(new Error("dns error"), { expected: true, alwaysRecord: true }),
    ).toBe(ErrorReportClass.Expected)
  })
})

describe("toError", () => {
  it("passes Error instances through unchanged", () => {
    const err = new Error("boom")
    expect(toError(err)).toBe(err)
  })

  it("wraps strings", () => {
    expect(toError("boom").message).toBe("boom")
  })

  it("wraps other values via JSON", () => {
    expect(toError({ code: 7 }).message).toBe('{"code":7}')
  })

  it("never throws on circular values (falls back to String)", () => {
    const circular: { self?: unknown } = {}
    circular.self = circular

    expect(toError(circular).message).toBe("[object Object]")
  })
})

describe("recordAppError", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetErrorReportingForTesting()
    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)
  })

  it("records a defect and leaves a [defect] breadcrumb", () => {
    recordAppError(new Error("assertion failed"))

    expect(mockLog).toHaveBeenCalledWith("[defect] assertion failed")
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "assertion failed" }),
    )
  })

  it("downgrades connectivity errors to a [transient] breadcrumb", () => {
    recordAppError(new Error("transport error: dns error"))

    expect(mockLog).toHaveBeenCalledWith("[transient] transport error: dns error")
    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("downgrades expected states to an [expected] breadcrumb", () => {
    recordAppError(new Error("FingerprintScannerNotEnrolled"), { expected: true })

    expect(mockLog).toHaveBeenCalledWith("[expected] FingerprintScannerNotEnrolled")
    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("alwaysRecord records even when the message matches connectivity patterns", () => {
    recordAppError(new Error("render timed out"), { alwaysRecord: true })

    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "render timed out" }),
    )
  })

  it("records a deduped defect only once per key but breadcrumbs every occurrence", () => {
    const fresh = loadFreshErrorReportingModule()

    fresh.recordAppError(new Error("first"), { dedupKey: "area-what" })
    fresh.recordAppError(new Error("second"), { dedupKey: "area-what" })

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe("first")
    expect(mockLog).toHaveBeenCalledTimes(2)
  })

  it("distinct dedup keys record independently", () => {
    const fresh = loadFreshErrorReportingModule()

    fresh.recordAppError(new Error("a"), { dedupKey: "key-a" })
    fresh.recordAppError(new Error("b"), { dedupKey: "key-b" })

    expect(mockRecordError).toHaveBeenCalledTimes(2)
  })

  it("dedup does not consume the key for non-defect classes", () => {
    const fresh = loadFreshErrorReportingModule()

    fresh.recordAppError(new Error("dns error"), { dedupKey: "flip-flop" })
    fresh.recordAppError(new Error("real defect"), { dedupKey: "flip-flop" })

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe("real defect")
  })
})

/**
 * AD-13 / AD-30 / NFR-P1. Every non-fatal and breadcrumb in the app funnels through this
 * sink, so this is where "nothing leaves an incognito or unresolved device" is enforced
 * for error reporting — including the `reportError()` sites in the SDK lifecycle hook that
 * do not go through `logSdkEvent`, and the screens that used to reach Crashlytics directly.
 *
 * The disposition has three states, and the sink must tell the two closed ones apart:
 * `unresolved` holds, `denied` drops. A sink that held under both would carry an incognito
 * device's errors out on a later switch to Enhanced (the second review's HIGH 2).
 */
describe("recordAppError — the zero-transmission gate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetErrorReportingForTesting()
    resetTransmissibilityForTesting()
  })

  describe("while the device has not resolved", () => {
    it("holds a non-fatal, and sends nothing", () => {
      reportError("SDK init", new Error("init failed for account"))

      expect(mockLog).not.toHaveBeenCalled()
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it("withholds a breadcrumb outright — context for a report that will carry its own", () => {
      logBreadcrumb("[self-custodial delete] storage dir unlink failed")

      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

      expect(mockLog).not.toHaveBeenCalled()
    })

    it("releases what it held once the device turns out to be custodial", () => {
      // A custodial user's start-up failure, raised before the mode resolved. It reaches
      // Crashlytics a few hundred milliseconds late rather than never.
      reportError("remote config", new Error("fetchAndActivate failed"))
      expect(mockRecordError).not.toHaveBeenCalled()

      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "fetchAndActivate failed" }),
      )
    })

    it("releases what it held once the device turns out to be Enhanced", () => {
      reportError("SDK init", new Error("init failed for account"))

      setDiagnosticsModeInput(DiagnosticsModeInput.SelfCustodial)

      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it("drops what it held when the device resolves incognito, and a later grant finds nothing", () => {
      reportError("SDK init", new Error("init failed for account"))

      setDiagnosticsModeInput(DiagnosticsModeInput.Denied)
      setDiagnosticsModeInput(DiagnosticsModeInput.SelfCustodial)

      expect(mockRecordError).not.toHaveBeenCalled()
      expect(mockLog).not.toHaveBeenCalled()
    })

    it("bounds what it holds", () => {
      for (let i = 0; i < 40; i += 1) reportError("loop", new Error(`spam ${i}`))

      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

      expect(mockRecordError.mock.calls.length).toBeLessThanOrEqual(20)
    })
  })

  describe("while the device is one that must emit zero", () => {
    beforeEach(() => {
      setDiagnosticsModeInput(DiagnosticsModeInput.Denied)
    })

    it("drops a non-fatal rather than holding it", () => {
      reportError("SDK init", new Error("init failed for account"))

      expect(mockLog).not.toHaveBeenCalled()
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it("drops a breadcrumb", () => {
      logBreadcrumb("[SparkSDK] payment received: 21000 sat")

      expect(mockLog).not.toHaveBeenCalled()
    })

    it("does not upload an incognito-era error after the account switches to Enhanced", () => {
      // The orchestrator's probe: denied → record → permitted. The error belongs to the
      // device as it was when it was raised, and nothing about a later switch changes that.
      reportError("SDK init", new Error("raised while incognito"))

      setDiagnosticsModeInput(DiagnosticsModeInput.SelfCustodial)

      expect(mockRecordError).not.toHaveBeenCalled()
      expect(mockLog).not.toHaveBeenCalled()
    })

    it("does not upload it after a switch to custodial either", () => {
      reportError("SDK init", new Error("raised while incognito"))

      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it("holds again only what is raised after the device goes back to unresolved", () => {
      reportError("SDK init", new Error("raised while incognito"))
      setDiagnosticsModeInput(DiagnosticsModeInput.Unresolved)
      reportError("SDK init", new Error("raised while unresolved"))

      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0].message).toBe("raised while unresolved")
    })
  })

  it("transmits immediately once the device may report (anchor)", () => {
    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

    reportError("SDK init", new Error("init failed for account"))

    expect(mockRecordError).toHaveBeenCalledTimes(1)
  })

  describe("automatic crash collection follows the disposition (AD-13, NFR-P1)", () => {
    // The switch that changes the running process is native (CrashCollection, both
    // platforms); it also records the provenance the next launch decides by. The RNFB
    // preference is kept in step so its own gate on log()/recordError() agrees.
    it("turns collection on natively, and in the RNFB preference, for a device that may report", () => {
      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

      expect(mockNativeSetDisposition).toHaveBeenLastCalledWith(true)
      expect(mockSetCollectionEnabled).toHaveBeenLastCalledWith(true)
    })

    it("turns it off for a device that must emit zero", () => {
      setDiagnosticsModeInput(DiagnosticsModeInput.Denied)

      expect(mockNativeSetDisposition).toHaveBeenLastCalledWith(false)
      expect(mockSetCollectionEnabled).toHaveBeenLastCalledWith(false)
    })

    it("turns it off when the kill switch engages on an Enhanced device", () => {
      setDiagnosticsModeInput(DiagnosticsModeInput.SelfCustodial)
      expect(mockNativeSetDisposition).toHaveBeenLastCalledWith(true)

      setSelfCustodialDiagnosticsShutdown(true)

      expect(mockNativeSetDisposition).toHaveBeenLastCalledWith(false)
    })

    it("touches nothing on the way into unresolved — the native launch default stands", () => {
      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)
      mockNativeSetDisposition.mockClear()
      mockSetCollectionEnabled.mockClear()

      setDiagnosticsModeInput(DiagnosticsModeInput.Unresolved)

      expect(mockNativeSetDisposition).not.toHaveBeenCalled()
      expect(mockSetCollectionEnabled).not.toHaveBeenCalled()
    })

    it("lets the disposition change complete when the native module is absent", () => {
      const saved = NativeModules.CrashCollection
      delete NativeModules.CrashCollection

      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)
      reportError("SDK init", new Error("still reported"))

      NativeModules.CrashCollection = saved
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it("lets it complete when the SDK throws", () => {
      mockSetCollectionEnabled.mockImplementationOnce(() => {
        throw new Error("native module not linked")
      })

      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)
      reportError("SDK init", new Error("still reported"))

      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockNativeSetDisposition).toHaveBeenLastCalledWith(true)
    })
  })

  describe("never throws when the native module is not linked", () => {
    // The sink is what the boundary's own fault reporter calls, and it runs at start-up
    // under the mode gate's initialisation; a synchronous throw from `crashlytics()` here
    // would surface at module scope during bundle evaluation.
    beforeEach(() => {
      mockCrashlyticsUnlinked = true
    })
    afterEach(() => {
      mockCrashlyticsUnlinked = false
    })

    it("reports and breadcrumbs quietly while permitted", () => {
      setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

      expect(() => reportError("SDK init", new Error("defect"))).not.toThrow()
      expect(() => logBreadcrumb("[SparkSDK] line")).not.toThrow()
    })

    it("releases the held buffer quietly on a grant", () => {
      reportError("remote config", new Error("held"))

      expect(() => setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)).not.toThrow()
    })
  })

  it("keeps custodial reporting open whatever the self-custodial kill switch says", () => {
    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)
    setSelfCustodialDiagnosticsShutdown(true)

    reportError("SDK init", new Error("custodial defect"))

    expect(mockRecordError).toHaveBeenCalledTimes(1)
  })

  it("closes Enhanced reporting the moment the kill switch engages (NFR-O4)", () => {
    setDiagnosticsModeInput(DiagnosticsModeInput.SelfCustodial)
    setSelfCustodialDiagnosticsShutdown(true)

    reportError("SDK init", new Error("enhanced defect"))
    logBreadcrumb("[SparkSDK] payment received: 21000 sat")

    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLog).not.toHaveBeenCalled()
  })
})
