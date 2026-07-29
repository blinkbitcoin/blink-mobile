import { Network } from "@breeztech/breez-sdk-spark-react-native"

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

jest.mock("@app/self-custodial/logging", () => ({
  logSdkEvent: (...args: unknown[]) => mockLogSdkEvent(...args),
  SdkLogLevel: { Error: "error" },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: jest.fn(),
}))

describe("validateStoredNetwork", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns true when no stored network (legacy wallets)", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue(null)

    expect(await validateStoredNetwork("test-account-id", Network.Regtest)).toBe(true)
    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLogSdkEvent).not.toHaveBeenCalled()
  })

  it("returns true when stored network matches config", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("regtest")

    expect(await validateStoredNetwork("test-account-id", Network.Regtest)).toBe(true)
    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLogSdkEvent).not.toHaveBeenCalled()
  })

  it("returns false on network mismatch", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("mainnet")

    expect(await validateStoredNetwork("test-account-id", Network.Regtest)).toBe(false)
  })

  it("reports the mismatch only through the SDK log channel (which records via the boundary)", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("mainnet")

    await validateStoredNetwork("test-account-id", Network.Regtest)

    // No direct recordError: logSdkEvent at Error level owns recording (with
    // session dedup) since the boundary refactor.
    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLogSdkEvent).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Network mismatch"),
    )
  })

  it("emits an SDK log event at Error level with the mismatch message", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("mainnet")

    await validateStoredNetwork("test-account-id", Network.Regtest)

    expect(mockLogSdkEvent).toHaveBeenCalledTimes(1)
    expect(mockLogSdkEvent).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Network mismatch"),
    )
    expect(mockLogSdkEvent.mock.calls[0][1]).toContain("wallet=mainnet")
    expect(mockLogSdkEvent.mock.calls[0][1]).toContain("config=regtest")
  })
})
