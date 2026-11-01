import {
  SdkLogLevel,
  createSdkLogListener,
  logSdkEvent,
  scrubSdkLogLine,
} from "@app/self-custodial/logging"

const mockLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

// The recordError dedup Set lives in @app/utils/error-reporting; reload the module
// graph to reset it between dedup-sensitive tests (same pattern as is-online.spec.ts).
const loadFreshLoggingModule = () => {
  let mod: typeof import("@app/self-custodial/logging") | undefined
  jest.isolateModules(() => {
    mod = require("@app/self-custodial/logging")
  })
  return mod!
}

describe("logSdkEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

  it("keeps info in the console, where every payment the SDK emits is logged", () => {
    logSdkEvent(SdkLogLevel.Info, "info message")

    expect(console.debug).toHaveBeenCalledWith("[SparkSDK] info message")
    expect(mockLog).not.toHaveBeenCalled()
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

  it("scrubs a warning before it becomes a breadcrumb", () => {
    logSdkEvent(
      SdkLogLevel.Warn,
      'Retrying send: Payment { invoice: "lnbc210n1p4wrhymabcdefghijklmnop" }',
    )

    expect(console.warn).toHaveBeenCalledWith(
      '[SparkSDK] Retrying send: Payment { invoice: "lnbc210n1p4wrhymabcdefghijklmnop" }',
    )
    expect(mockLog).toHaveBeenCalledWith(
      '[SparkSDK] Retrying send: Payment { invoice: "…" }',
    )
  })

  it("scrubs an error before it is recorded, and still classifies it on its raw text", () => {
    const fresh = loadFreshLoggingModule()
    fresh.logSdkEvent(
      SdkLogLevel.Error,
      'Send to catalyst@blink.sv failed: Payment { amount: 21, invoice: "lnbc210n1p4wrhymabcdefghijklmnop" }',
    )

    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          '[SparkSDK] Send to <address> failed: Payment { amount: #, invoice: "…" }',
      }),
    )
  })

  it("classifies on the raw line when only a scrubbed field said it was connectivity", () => {
    const fresh = loadFreshLoggingModule()
    fresh.logSdkEvent(
      SdkLogLevel.Error,
      'Failed to sync: Status { code: Internal, message: "transport error" }',
    )

    expect(mockLog).toHaveBeenCalledWith(
      '[transient] [SparkSDK] Failed to sync: Status { code: Internal, message: "…" }',
    )
    expect(mockRecordError).not.toHaveBeenCalled()
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

describe("createSdkLogListener", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
    expect(mockLog).not.toHaveBeenCalled()
  })

  it("maps unknown level to info", () => {
    const listener = createSdkLogListener()

    listener.log({ level: "UNKNOWN", line: "bad level" })

    expect(console.debug).toHaveBeenCalledWith("[SparkSDK] bad level")
    expect(console.warn).not.toHaveBeenCalled()
    expect(mockLog).not.toHaveBeenCalled()
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

describe("scrubSdkLogLine", () => {
  it("strips a whole emitted Payment down to its shape", () => {
    const line =
      'emit(PaymentSucceeded: Payment { id: "98b2cc49-7e3d-43b8-b566-87d46071d51e", payment_type: Send, status: Completed, amount: 21, fees: 0, timestamp: 1793186974, method: Lightning, details: Some(Lightning { description: Some("Pay to catalyst@blink.sv"), invoice: "lnbc210n1p4wrhymabcdefghijklmnop", destination_pubkey: "03093651a7e1d3c1b2f4e5d6c7b8a9f0e1d2c3b4a5968778695a4b3c2d1e0f1a2b" }) }) internal listener 0: 1.2ms'

    expect(scrubSdkLogLine(line)).toBe(
      'emit(PaymentSucceeded: Payment { id: "…", payment_type: Send, status: Completed, amount: #, fees: #, timestamp: 1793186974, method: Lightning, details: Some(Lightning { description: Some("…"), invoice: "…", destination_pubkey: "…" }) }) internal listener 0: 1.2ms',
    )
  })

  it("keeps a URL's host and drops the path and query", () => {
    expect(
      scrubSdkLogLine(
        "Making GET request to: https://lnurl.blink.sv/lnurlp/blink.sv/catalyst/invoice?amount=21000&comment=Pay+to+catalyst%40blink.sv",
      ),
    ).toBe("Making GET request to: https://lnurl.blink.sv/…")
  })

  it("drops a byte array such as an identity pubkey", () => {
    expect(
      scrubSdkLogLine(
        "QueryNodesRequest { source: Some(OwnerIdentityPubkey([2, 176, 67, 202, 43, 164, 175, 8, 40])) }",
      ),
    ).toBe("QueryNodesRequest { source: Some(OwnerIdentityPubkey([…])) }")
  })

  it("masks identifiers that appear outside a field", () => {
    expect(
      scrubSdkLogLine(
        "paid 03093651a7e1d3c1b2f4e5d6c7b8a9f0e1d2c3b4a5968778695a4b3c2d1e0f1a2b via bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq from 1BoatSLRHtKNngkdXEeobR76b53LETtpyT for user@example.com, payment 98b2cc49-7e3d-43b8-b566-87d46071d51e",
      ),
    ).toBe("paid <hex> via <address> from <address> for <address>, payment <id>")
  })

  it("masks invoices and LNURLs that appear outside a field", () => {
    expect(
      scrubSdkLogLine(
        "could not pay lnbc210n1p4wrhymabcdefghijklmnop, nor lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns",
      ),
    ).toBe("could not pay <invoice>, nor <lnurl>")
  })

  it("leaves error text in tuple form readable", () => {
    const line =
      'Failed to recover lightning address on startup: NetworkError("failed to deserialize response json: missing field `lnurl` at line 1 column 15")'

    expect(scrubSdkLogLine(line)).toBe(line)
  })
})
