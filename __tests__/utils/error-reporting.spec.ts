import {
  ErrorReportClass,
  classifyError,
  isConnectivityError,
  errorKind,
  recordAppError,
  toError,
} from "@app/utils/error-reporting"

const mockLog = jest.fn()
const mockRecordError = jest.fn()
const mockCrash = jest.fn()
const mockSetCollection = jest.fn(
  (_enabled: boolean): Promise<unknown> => Promise.resolve(null),
)
const mockDeleteUnsentReports = jest.fn(() => Promise.resolve())
const mockCheckForUnsentReports = jest.fn(() => Promise.resolve(false))
let mockCollectionEnabled = true

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
  crash: () => mockCrash(),
  get isCrashlyticsCollectionEnabled() {
    return mockCollectionEnabled
  },
  setCrashlyticsCollectionEnabled: (enabled: boolean) => mockSetCollection(enabled),
  checkForUnsentReports: () => mockCheckForUnsentReports(),
  deleteUnsentReports: () => mockDeleteUnsentReports(),
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

  it("never throws on circular values (falls back to String)", () => {
    const circular: { self?: unknown } = {}
    circular.self = circular

    expect(toError(circular).message).toBe("[object Object]")
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

  it("writes nothing while crash reporting is closed, and resumes once reopened", () => {
    const fresh = loadFreshErrorReportingModule()

    fresh.setCrashReportingOpen(false)
    fresh.recordAppError(new Error("closed defect"))
    fresh.logBreadcrumb("closed breadcrumb")
    fresh.setCrashReportingOpen(true)
    fresh.recordAppError(new Error("open defect"))
    fresh.logBreadcrumb("open breadcrumb")

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe("open defect")
    expect(mockLog.mock.calls).toEqual([["[defect] open defect"], ["open breadcrumb"]])
  })

  it("dedup does not consume the key for non-defect classes", () => {
    const fresh = loadFreshErrorReportingModule()

    fresh.recordAppError(new Error("dns error"), { dedupKey: "flip-flop" })
    fresh.recordAppError(new Error("real defect"), { dedupKey: "flip-flop" })

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe("real defect")
  })
})

describe("collection control", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCollectionEnabled = true
    mockSetCollection.mockImplementation(() => Promise.resolve(null))
  })

  it("shuts the gate before the switch is even asked", () => {
    const fresh = loadFreshErrorReportingModule()
    mockSetCollection.mockImplementation(() => new Promise(() => {}))

    fresh.closeCrashReporting()
    fresh.logBreadcrumb("after close")

    expect(mockSetCollection).toHaveBeenCalledWith(false)
    expect(mockLog).not.toHaveBeenCalled()
  })

  it("turns a throwing switch into a rejection, gate still shut", async () => {
    const fresh = loadFreshErrorReportingModule()
    mockSetCollection.mockImplementation(() => {
      throw new Error("native module missing")
    })

    const closing = fresh.closeCrashReporting()
    fresh.logBreadcrumb("after close")

    await expect(closing).rejects.toThrow("native module missing")
    expect(mockLog).not.toHaveBeenCalled()
  })

  describe("releasing held reports", () => {
    beforeEach(() => {
      mockCollectionEnabled = false
      mockCheckForUnsentReports.mockReset()
      mockCheckForUnsentReports.mockImplementation(() => Promise.resolve(false))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("has nothing to do while collection is already on", async () => {
      const fresh = loadFreshErrorReportingModule()
      mockCollectionEnabled = true

      await expect(fresh.releaseHeldCrashReports()).resolves.toBe(true)
      expect(mockCheckForUnsentReports).not.toHaveBeenCalled()
      expect(mockDeleteUnsentReports).not.toHaveBeenCalled()
    })

    it("lets collection back on when this launch started with nothing held", async () => {
      const fresh = loadFreshErrorReportingModule()

      await expect(fresh.releaseHeldCrashReports()).resolves.toBe(true)
      expect(mockDeleteUnsentReports).not.toHaveBeenCalled()
    })

    /** The SDK reports no deletion's end, and an enable that reaches its startup first
     *  sends what it was deleting; only the next launch's check can show they are gone. */
    it("deletes what this launch started with and keeps collection off", async () => {
      const fresh = loadFreshErrorReportingModule()
      mockCheckForUnsentReports.mockResolvedValue(true)

      await expect(fresh.releaseHeldCrashReports()).resolves.toBe(false)
      expect(mockDeleteUnsentReports).toHaveBeenCalledTimes(1)
    })

    /** A second ask is told false whatever the first was told. */
    it("asks the SDK once per process and keeps its answer", async () => {
      const fresh = loadFreshErrorReportingModule()
      mockCheckForUnsentReports.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

      await fresh.releaseHeldCrashReports()
      await expect(fresh.releaseHeldCrashReports()).resolves.toBe(false)
      expect(mockCheckForUnsentReports).toHaveBeenCalledTimes(1)
    })

    it("counts no answer in time as held", async () => {
      jest.useFakeTimers()
      const fresh = loadFreshErrorReportingModule()
      mockCheckForUnsentReports.mockImplementation(() => new Promise(() => {}))

      const releasing = fresh.releaseHeldCrashReports()
      await jest.advanceTimersByTimeAsync(fresh.HELD_REPORTS_CHECK_TIMEOUT_MS)

      await expect(releasing).resolves.toBe(false)
      expect(mockDeleteUnsentReports).toHaveBeenCalledTimes(1)
    })

    it("counts a failed check as held", async () => {
      const fresh = loadFreshErrorReportingModule()
      mockCheckForUnsentReports.mockRejectedValue(new Error("native module missing"))

      await expect(fresh.releaseHeldCrashReports()).resolves.toBe(false)
    })
  })

  it("turns collection on without reopening the gate", async () => {
    const fresh = loadFreshErrorReportingModule()
    fresh.setCrashReportingOpen(false)

    await fresh.enableCrashCollection()
    fresh.logBreadcrumb("still closed")

    expect(mockSetCollection).toHaveBeenCalledWith(true)
    expect(mockLog).not.toHaveBeenCalled()
  })

  it("leaves the crash test's breadcrumb only while open", () => {
    const fresh = loadFreshErrorReportingModule()

    fresh.setCrashReportingOpen(false)
    fresh.crashForTesting()
    fresh.setCrashReportingOpen(true)
    fresh.crashForTesting()

    expect(mockLog.mock.calls).toEqual([["Testing crash"]])
    expect(mockCrash).toHaveBeenCalledTimes(2)
  })
})

describe("errorKind", () => {
  it("keeps an error's class name and drops its text", () => {
    class ContactError extends Error {
      name = "ContactError"
    }

    expect(errorKind(new ContactError("failed to add alice@example.com"))).toBe(
      "ContactError",
    )
  })

  it("names connectivity failures as such", () => {
    expect(errorKind(new Error("transport error: dns error"))).toBe("connectivity")
  })

  it("never passes on a class name that could carry data", () => {
    const err = new Error("boom")
    err.name = "alice@example.com"

    expect(errorKind(err)).toBe("object")
  })

  it("names a thrown non-error by its type alone", () => {
    expect(errorKind("/data/user/0/app/files/spark/account-123")).toBe("string")
  })
})
