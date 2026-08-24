import { reportError } from "@app/utils/error-logging"

const mockLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

const loadFreshErrorLoggingModule = () => {
  let mod: typeof import("@app/utils/error-logging") | undefined
  jest.isolateModules(() => {
    mod = require("@app/utils/error-logging")
  })
  return mod!
}

describe("reportError", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("passes an existing Error through unchanged, preserving the instance", () => {
    const err = new Error("registry write failed")

    reportError("Sync", err)

    expect(mockRecordError).toHaveBeenCalledWith(err, "Sync")
  })

  /** The regression this guards: an `Error` used to reach Crashlytics with the operation
   *  dropped, so a native failure landed on the dashboard as an anonymous error nobody could
   *  trace to a flow, and alerting keyed on the operation never fired. */
  it("carries the operation on an Error, without rewriting its message or stack", () => {
    const err = new Error("native crypto unavailable")
    const originalStack = err.stack

    reportError("Cloud backup encryption", err)

    expect(mockRecordError).toHaveBeenCalledWith(err, "Cloud backup encryption")
    expect(mockRecordError.mock.calls[0][0].message).toBe("native crypto unavailable")
    expect(mockRecordError.mock.calls[0][0].stack).toBe(originalStack)
    expect(mockLog).toHaveBeenCalledWith("[defect] native crypto unavailable")
  })

  it("wraps non-Error throws, carrying the operation alongside", () => {
    reportError("Sync", "string rejection")

    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sync failed: string rejection" }),
      "Sync",
    )
  })

  it("classifies connectivity-shaped errors as breadcrumbs, even after wrapping", () => {
    reportError("Sync", "transport error: dns error")

    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLog).toHaveBeenCalledWith(
      "[transient] Sync failed: transport error: dns error",
    )
  })

  it("forwards the expected flag", () => {
    reportError("Backup", new Error("user declined"), { expected: true })

    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLog).toHaveBeenCalledWith("[expected] user declined")
  })

  it("forwards dedupKey so repeated failures record only once per session", () => {
    const fresh = loadFreshErrorLoggingModule()

    fresh.reportError("Sync", new Error("first"), { dedupKey: "sync-write" })
    fresh.reportError("Sync", new Error("second"), { dedupKey: "sync-write" })

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe("first")
  })
})
