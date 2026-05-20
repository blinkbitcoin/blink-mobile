import { validateStoredNetwork } from "@app/self-custodial/providers/validate-network"

const mockGetMnemonicNetworkForAccount = jest.fn()
const mockLogSdkEvent = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonicNetworkForAccount: (id: string) => mockGetMnemonicNetworkForAccount(id),
  },
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkNetworkLabel: "regtest",
}))

jest.mock("@app/self-custodial/logging", () => ({
  logSdkEvent: (...args: unknown[]) => mockLogSdkEvent(...args),
  SdkLogLevel: { Error: "error" },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

describe("validateStoredNetwork", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns true when no stored network (legacy wallets)", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue(null)

    expect(await validateStoredNetwork("test-account-id")).toBe(true)
    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLogSdkEvent).not.toHaveBeenCalled()
  })

  it("returns true when stored network matches config", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("regtest")

    expect(await validateStoredNetwork("test-account-id")).toBe(true)
    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLogSdkEvent).not.toHaveBeenCalled()
  })

  it("returns false on network mismatch", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("mainnet")

    expect(await validateStoredNetwork("test-account-id")).toBe(false)
  })

  it("records the mismatch to crashlytics with the wallet/config networks in the message (Important #9)", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("mainnet")

    await validateStoredNetwork("test-account-id")

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    const recordedError = mockRecordError.mock.calls[0][0]
    expect(recordedError).toBeInstanceOf(Error)
    expect(recordedError.message).toContain("Network mismatch")
    expect(recordedError.message).toContain("wallet=mainnet")
    expect(recordedError.message).toContain("config=regtest")
  })

  it("emits an SDK log event at Error level with the mismatch message (Important #9)", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("mainnet")

    await validateStoredNetwork("test-account-id")

    expect(mockLogSdkEvent).toHaveBeenCalledTimes(1)
    expect(mockLogSdkEvent).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Network mismatch"),
    )
    expect(mockLogSdkEvent.mock.calls[0][1]).toContain("wallet=mainnet")
    expect(mockLogSdkEvent.mock.calls[0][1]).toContain("config=regtest")
  })
})
