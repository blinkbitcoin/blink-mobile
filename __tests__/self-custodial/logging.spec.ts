import { SdkLogLevel, connectToSdkLogger, logSdkEvent } from "@app/self-custodial/logging"

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

describe("connectToSdkLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "debug").mockImplementation()
    jest.spyOn(console, "warn").mockImplementation()
    jest.spyOn(console, "error").mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("wires SDK event listener to logSdkEvent", async () => {
    let capturedListener: { onEvent: (e: { level: string; line: string }) => void }

    const mockSdk = {
      addEventListener: jest.fn().mockImplementation((listener) => {
        capturedListener = listener
        return Promise.resolve("listener-id")
      }),
    }

    const listenerId = await connectToSdkLogger(mockSdk)

    expect(listenerId).toBe("listener-id")
    expect(mockSdk.addEventListener).toHaveBeenCalledTimes(1)

    capturedListener!.onEvent({ level: "INFO", line: "sdk initialized" })

    expect(console.debug).toHaveBeenCalledWith("[SparkSDK] sdk initialized")
    expect(mockLog).toHaveBeenCalledWith("[SparkSDK] sdk initialized")
  })

  it("maps unknown level to info", async () => {
    let capturedListener: { onEvent: (e: { level: string; line: string }) => void }

    const mockSdk = {
      addEventListener: jest.fn().mockImplementation((listener) => {
        capturedListener = listener
        return Promise.resolve("id")
      }),
    }

    await connectToSdkLogger(mockSdk)
    capturedListener!.onEvent({ level: "UNKNOWN", line: "bad level" })

    expect(console.debug).toHaveBeenCalledWith("[SparkSDK] bad level")
    expect(mockLog).toHaveBeenCalledWith("[SparkSDK] bad level")
  })
})
