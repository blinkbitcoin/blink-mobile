import { logError } from "@app/utils/log-error"

const mockLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

const loadFreshLogErrorModule = () => {
  let mod: typeof import("@app/utils/log-error") | undefined
  jest.isolateModules(() => {
    mod = require("@app/utils/log-error")
  })
  return mod!
}

describe("logError", () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("forwards an Error to crashlytics with the scope prefixed in the message", () => {
    logError({ scope: "remote-config", error: new Error("bad json") })

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    const recorded = mockRecordError.mock.calls[0][0] as Error
    expect(recorded).toBeInstanceOf(Error)
    expect(recorded.message).toBe("[remote-config] bad json")
  })

  it("wraps a string error in an Error before forwarding", () => {
    logError({ scope: "compliance", error: "ipapi unreachable" })

    const recorded = mockRecordError.mock.calls[0][0] as Error
    expect(recorded).toBeInstanceOf(Error)
    expect(recorded.message).toBe("[compliance] ipapi unreachable")
  })

  it("downgrades connectivity-class errors to a breadcrumb", () => {
    logError({ scope: "compliance", error: "ipapi timeout" })

    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLog).toHaveBeenCalledWith("[transient] [compliance] ipapi timeout")
  })

  it("forwards dedupKey so repeated failures record only once per session", () => {
    const fresh = loadFreshLogErrorModule()

    fresh.logError({
      scope: "remote-config",
      error: new Error("fetch exploded"),
      dedupKey: "remote-config-fetch",
    })
    fresh.logError({
      scope: "remote-config",
      error: new Error("fetch exploded again"),
      dedupKey: "remote-config-fetch",
    })

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect((mockRecordError.mock.calls[0][0] as Error).message).toBe(
      "[remote-config] fetch exploded",
    )
  })

  it("downgrades caller-declared expected states to a breadcrumb", () => {
    logError({ scope: "backup", error: new Error("user declined"), expected: true })

    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLog).toHaveBeenCalledWith("[expected] [backup] user declined")
  })

  it("wraps a non-string non-Error value via JSON.stringify", () => {
    logError({ scope: "config", error: { code: 42 } })

    const recorded = mockRecordError.mock.calls[0][0] as Error
    expect(recorded.message).toBe('[config] {"code":42}')
  })
})
