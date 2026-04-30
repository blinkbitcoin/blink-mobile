import { validateStoredNetwork } from "@app/self-custodial/providers/validate-network"

const mockGetMnemonicNetworkForAccount = jest.fn()

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
  logSdkEvent: jest.fn(),
  SdkLogLevel: { Error: "error" },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
}))

describe("validateStoredNetwork", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns true when no stored network (legacy wallets)", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue(null)

    expect(await validateStoredNetwork("test-account-id")).toBe(true)
  })

  it("returns true when stored network matches config", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("regtest")

    expect(await validateStoredNetwork("test-account-id")).toBe(true)
  })

  it("returns false on network mismatch", async () => {
    mockGetMnemonicNetworkForAccount.mockResolvedValue("mainnet")

    expect(await validateStoredNetwork("test-account-id")).toBe(false)
  })
})
