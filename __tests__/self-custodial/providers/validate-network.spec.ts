import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { validateStoredNetwork } from "@app/self-custodial/providers/validate-network"

const mockReadMnemonicNetworkWithStatus = jest.fn()
const mockLogSdkEvent = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    readMnemonicNetworkWithStatus: (id: string) => mockReadMnemonicNetworkWithStatus(id),
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
    mockReadMnemonicNetworkWithStatus.mockResolvedValue({ status: "absent" })

    expect(await validateStoredNetwork("test-account-id", Network.Regtest)).toBe(true)
    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLogSdkEvent).not.toHaveBeenCalled()
  })

  /**
   * The failure this guards is silent: a null marker reports no mismatch, so a
   * read that merely failed would let the wallet connect on a network nothing
   * verified. Absent still means "legacy wallet, allow it"; failed must not.
   */
  it("refuses to connect when the marker could not be read, unlike when there is none", async () => {
    mockReadMnemonicNetworkWithStatus.mockResolvedValue({
      status: "failed",
      err: new Error("keychain locked"),
    })

    expect(await validateStoredNetwork("test-account-id", Network.Regtest)).toBe(false)
    expect(mockLogSdkEvent).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Network marker unreadable"),
    )
    // The cause stays out: a keychain error can carry the server string, which
    // ends in the account id.
    expect(mockLogSdkEvent.mock.calls[0][1]).not.toContain("test-account-id")
    expect(mockLogSdkEvent.mock.calls[0][1]).not.toContain("keychain locked")
    // Distinguishable from a real mismatch, which is the only thing the caller
    // cannot tell apart on its own.
    expect(mockLogSdkEvent.mock.calls[0][1]).not.toContain("Network mismatch")
  })

  it("returns true when stored network matches config", async () => {
    mockReadMnemonicNetworkWithStatus.mockResolvedValue({
      status: "found",
      value: "regtest",
    })

    expect(await validateStoredNetwork("test-account-id", Network.Regtest)).toBe(true)
    expect(mockRecordError).not.toHaveBeenCalled()
    expect(mockLogSdkEvent).not.toHaveBeenCalled()
  })

  it("returns false on network mismatch", async () => {
    mockReadMnemonicNetworkWithStatus.mockResolvedValue({
      status: "found",
      value: "mainnet",
    })

    expect(await validateStoredNetwork("test-account-id", Network.Regtest)).toBe(false)
  })

  it("reports the mismatch only through the SDK log channel (which records via the boundary)", async () => {
    mockReadMnemonicNetworkWithStatus.mockResolvedValue({
      status: "found",
      value: "mainnet",
    })

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
    mockReadMnemonicNetworkWithStatus.mockResolvedValue({
      status: "found",
      value: "mainnet",
    })

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
