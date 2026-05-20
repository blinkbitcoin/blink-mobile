import { validateStoredNetwork } from "@app/self-custodial/providers/validate-network"

const mockGetMnemonicNetwork = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonicNetwork: () => mockGetMnemonicNetwork(),
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
    mockGetMnemonicNetwork.mockResolvedValue(null)

    expect(await validateStoredNetwork()).toBe(true)
  })

  it("returns true when stored network matches config", async () => {
    mockGetMnemonicNetwork.mockResolvedValue("regtest")

    expect(await validateStoredNetwork()).toBe(true)
  })

  it("returns false on network mismatch", async () => {
    mockGetMnemonicNetwork.mockResolvedValue("mainnet")

    expect(await validateStoredNetwork()).toBe(false)
  })
})
