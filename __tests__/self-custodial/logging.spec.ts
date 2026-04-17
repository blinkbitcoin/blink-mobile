import {
  SdkLogLevel,
  createSdkLogListener,
  logSdkEvent,
} from "@app/self-custodial/logging"

const mockLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

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
    logSdkEvent(SdkLogLevel.Error, "error message")

    expect(console.error).toHaveBeenCalledWith("[SparkSDK] error message")
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "[SparkSDK] error message" }),
    )
    expect(mockLog).not.toHaveBeenCalled()
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
