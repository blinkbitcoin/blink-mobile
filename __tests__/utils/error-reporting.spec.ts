import {
  ErrorReportClass,
  classifyError,
  isConnectivityError,
  recordAppError,
  toError,
} from "@app/utils/error-reporting"

const mockLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

const loadFreshErrorReportingModule = () => {
  let mod: typeof import("@app/utils/error-reporting") | undefined
  jest.isolateModules(() => {
    mod = require("@app/utils/error-reporting")
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
})

describe("recordAppError", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
