import {
  SdkLogLevel,
  createSdkLogListener,
  logSdkEvent,
} from "@app/self-custodial/logging"
import {
  DiagnosticsModeInput,
  resetDiagnosticsForTesting,
  setDiagnosticsModeInput,
} from "@app/telemetry/diagnostics"
import { resetErrorReportingForTesting } from "@app/utils/error-reporting"

const mockLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

// The recordError dedup Set lives in @app/utils/error-reporting; reload the module
// graph to reset it between dedup-sensitive tests (same pattern as is-online.spec.ts).
// The fresh graph has a fresh, closed boundary, so it is opened here as the suite's
// default: what these tests exercise is the log routing, not the gate.
const loadFreshLoggingModule = () => {
  let mod: typeof import("@app/self-custodial/logging") | undefined
  jest.isolateModules(() => {
    mod = require("@app/self-custodial/logging")
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const diagnostics: typeof import("@app/telemetry/diagnostics") = require("@app/telemetry/diagnostics")
    diagnostics.setDiagnosticsModeInput(diagnostics.DiagnosticsModeInput.Custodial)
  })
  return mod!
}

describe("logSdkEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDiagnosticsForTesting()
    resetErrorReportingForTesting()
    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)
    jest.spyOn(console, "debug").mockImplementation()
    jest.spyOn(console, "warn").mockImplementation()
    jest.spyOn(console, "error").mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("logs debug to console only", () => {
    logSdkEvent(SdkLogLevel.Debug, "debug message")

    expect(console.debug).toHaveBeenCalledWith("[SparkSDK] debug message")
    expect(mockLog).not.toHaveBeenCalled()
    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("logs info to console and crashlytics", () => {
    logSdkEvent(SdkLogLevel.Info, "info message")

    expect(console.debug).toHaveBeenCalledWith("[SparkSDK] info message")
    expect(mockLog).toHaveBeenCalledWith("[SparkSDK] info message")
    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("logs warn to console and crashlytics", () => {
    logSdkEvent(SdkLogLevel.Warn, "warn message")

    expect(console.warn).toHaveBeenCalledWith("[SparkSDK] warn message")
    expect(mockLog).toHaveBeenCalledWith("[SparkSDK] warn message")
    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("logs error to console and crashlytics recordError", () => {
    const fresh = loadFreshLoggingModule()
    fresh.logSdkEvent(SdkLogLevel.Error, "error message")

    expect(console.error).toHaveBeenCalledWith("[SparkSDK] error message")
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "[SparkSDK] error message" }),
    )
    expect(mockLog).toHaveBeenCalledWith("[defect] [SparkSDK] error message")
  })

  it("downgrades connectivity-class error lines to breadcrumbs", () => {
    const fresh = loadFreshLoggingModule()
    fresh.logSdkEvent(
      SdkLogLevel.Error,
      'Failed to subscribe to server events: Status { code: Unavailable, message: "dns error" }',
    )

    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("[transient]"))
  })

  it("records a repeated defect line only once per session", () => {
    const fresh = loadFreshLoggingModule()
    fresh.logSdkEvent(SdkLogLevel.Error, "state corrupted")
    fresh.logSdkEvent(SdkLogLevel.Error, "state corrupted")

    expect(mockRecordError).toHaveBeenCalledTimes(1)
  })

  it("dedups defect lines that differ only by digits (retry counters, ports)", () => {
    const fresh = loadFreshLoggingModule()
    fresh.logSdkEvent(SdkLogLevel.Error, "claim failed for leaf 12 (attempt 1)")
    fresh.logSdkEvent(SdkLogLevel.Error, "claim failed for leaf 98 (attempt 2)")

    expect(mockRecordError).toHaveBeenCalledTimes(1)
  })
})

describe("AD-13 / AD-30 — SDK log lines leave only a device permitted to report", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDiagnosticsForTesting()
    resetErrorReportingForTesting()
    /** An incognito device: the disposition the sink drops under, not holds under. */
    setDiagnosticsModeInput(DiagnosticsModeInput.Denied)
    jest.spyOn(console, "debug").mockImplementation()
    jest.spyOn(console, "warn").mockImplementation()
    jest.spyOn(console, "error").mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("keeps info and warn lines on the console while the boundary is closed", () => {
    // An SDK line routinely carries payment ids and amounts, and a breadcrumb is a
    // transmission with a device-stable installation id on it.
    logSdkEvent(SdkLogLevel.Info, "payment received: 21000 sat")
    logSdkEvent(SdkLogLevel.Warn, "retrying")

    expect(console.debug).toHaveBeenCalledWith("[SparkSDK] payment received: 21000 sat")
    expect(console.warn).toHaveBeenCalledWith("[SparkSDK] retrying")
    expect(mockLog).not.toHaveBeenCalled()
  })

  it("keeps error lines on the console and out of Crashlytics while closed", () => {
    logSdkEvent(SdkLogLevel.Error, "gate-closed defect line")

    expect(console.error).toHaveBeenCalledWith("[SparkSDK] gate-closed defect line")
    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLog).not.toHaveBeenCalled()
  })

  it("does not carry an incognito device's error lines out on a later switch to Enhanced", () => {
    // The second review's HIGH 2, at the SDK path: an error raised while the device was
    // incognito is dropped, not held, so a later grant has nothing to release.
    logSdkEvent(SdkLogLevel.Error, "incognito-era defect line")

    setDiagnosticsModeInput(DiagnosticsModeInput.SelfCustodial)

    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLog).not.toHaveBeenCalled()
  })

  it("holds an error line raised before the mode resolved, and releases it to a custodial device", () => {
    setDiagnosticsModeInput(DiagnosticsModeInput.Unresolved)
    logSdkEvent(SdkLogLevel.Error, "start-up defect line")
    expect(mockRecordError).not.toHaveBeenCalled()

    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe(
      "[SparkSDK] start-up defect line",
    )
  })

  it("transmits again once the boundary opens (anchor)", () => {
    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)

    logSdkEvent(SdkLogLevel.Info, "sdk initialized")

    expect(mockLog).toHaveBeenCalledWith("[SparkSDK] sdk initialized")
  })
})

describe("createSdkLogListener", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDiagnosticsForTesting()
    resetErrorReportingForTesting()
    setDiagnosticsModeInput(DiagnosticsModeInput.Custodial)
    jest.spyOn(console, "debug").mockImplementation()
    jest.spyOn(console, "warn").mockImplementation()
    jest.spyOn(console, "error").mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("creates a log listener that routes to logSdkEvent", () => {
    const listener = createSdkLogListener()

    listener.log({ level: "INFO", line: "sdk initialized" })

    expect(console.debug).toHaveBeenCalledWith("[SparkSDK] sdk initialized")
    expect(mockLog).toHaveBeenCalledWith("[SparkSDK] sdk initialized")
  })

  it("maps unknown level to info", () => {
    const listener = createSdkLogListener()

    listener.log({ level: "UNKNOWN", line: "bad level" })

    expect(console.debug).toHaveBeenCalledWith("[SparkSDK] bad level")
    expect(mockLog).toHaveBeenCalledWith("[SparkSDK] bad level")
  })

  it("suppresses 'Received empty event' log lines", () => {
    const listener = createSdkLogListener()

    listener.log({ level: "WARN", line: "Received empty event from relay" })

    expect(console.debug).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
    expect(mockLog).not.toHaveBeenCalled()
    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("forwards other warnings normally", () => {
    const listener = createSdkLogListener()

    listener.log({ level: "WARN", line: "something happened" })

    expect(console.warn).toHaveBeenCalledWith("[SparkSDK] something happened")
    expect(mockLog).toHaveBeenCalledWith("[SparkSDK] something happened")
  })
})
