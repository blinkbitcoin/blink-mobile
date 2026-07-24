import { addDeviceToken } from "@app/utils/notifications"

const mockGetToken = jest.fn()

jest.mock("@react-native-firebase/messaging", () => ({
  __esModule: true,
  default: () => ({ getToken: () => mockGetToken() }),
}))

const mockLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

const loadFreshNotificationsModule = () => {
  let mod: typeof import("@app/utils/notifications") | undefined
  jest.isolateModules(() => {
    mod = require("@app/utils/notifications")
  })
  return mod!
}

describe("addDeviceToken error reporting", () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("uploads the FCM token via the mutation", async () => {
    mockGetToken.mockResolvedValue("device-token")
    const client = { mutate: jest.fn().mockResolvedValue({}) }

    await addDeviceToken(client as never)

    expect(client.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { input: { deviceToken: "device-token" } } }),
    )
  })

  it("downgrades FCM token timeouts to a breadcrumb", async () => {
    mockGetToken.mockRejectedValue(new Error("java.io.IOException: TIMEOUT"))
    const client = { mutate: jest.fn() }

    await addDeviceToken(client as never)

    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("[transient]"))
    expect(client.mutate).not.toHaveBeenCalled()
  })

  it("records unexpected upload failures once per session", async () => {
    const fresh = loadFreshNotificationsModule()
    mockGetToken.mockResolvedValue("device-token")
    const client = {
      mutate: jest.fn().mockRejectedValue(new Error("GraphQL validation failed")),
    }

    await fresh.addDeviceToken(client as never)
    await fresh.addDeviceToken(client as never)

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe("GraphQL validation failed")
  })
})
