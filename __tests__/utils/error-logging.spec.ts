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

    expect(mockRecordError).toHaveBeenCalledWith(err)
  })

  it("wraps non-Error throws with the operation context", () => {
    reportError("Sync", "string rejection")

    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sync failed: string rejection" }),
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
