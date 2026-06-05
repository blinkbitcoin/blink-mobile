import { logError } from "@app/utils/log-error"

const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

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
    logError({ scope: "compliance", error: "ipapi timeout" })

    const recorded = mockRecordError.mock.calls[0][0] as Error
    expect(recorded).toBeInstanceOf(Error)
    expect(recorded.message).toBe("[compliance] ipapi timeout")
  })

  it("wraps a non-string non-Error value via JSON.stringify", () => {
    logError({ scope: "config", error: { code: 42 } })

    const recorded = mockRecordError.mock.calls[0][0] as Error
    expect(recorded.message).toBe('[config] {"code":42}')
  })
})
