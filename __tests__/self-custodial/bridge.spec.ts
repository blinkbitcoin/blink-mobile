import {
  selfCustodialCreateWallet,
  selfCustodialRestoreWallet,
} from "@app/self-custodial/bridge"

const mockSetMnemonic = jest.fn()
const mockGenerateMnemonic = jest.fn()
const mockConnect = jest.fn()
const mockDisconnect = jest.fn()
const mockUpdateUserSettings = jest.fn()

jest.mock("bip39", () => ({
  generateMnemonic: () => mockGenerateMnemonic(),
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: "mainnet" },
  Seed: { Mnemonic: jest.fn().mockImplementation((args) => args) },
  StableBalanceActiveLabel: {
    Set: jest.fn().mockImplementation((args) => ({ tag: "Set", inner: args })),
  },
  connect: (...args: readonly unknown[]) => mockConnect(...args),
  defaultConfig: jest.fn().mockReturnValue({}),
  initLogging: jest.fn(),
}))

jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
}))

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test/documents",
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    setMnemonic: (...args: string[]) => mockSetMnemonic(...args),
  },
}))

jest.mock("@app/self-custodial/logging", () => ({
  createSdkLogListener: jest.fn().mockReturnValue({ log: jest.fn() }),
}))

describe("selfCustodialCreateWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGenerateMnemonic.mockReturnValue(
      "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
    )
    mockSetMnemonic.mockResolvedValue(true)
    mockConnect.mockResolvedValue({
      updateUserSettings: mockUpdateUserSettings,
      disconnect: mockDisconnect,
    })
    mockUpdateUserSettings.mockResolvedValue(undefined)
    mockDisconnect.mockResolvedValue(undefined)
  })

  it("generates mnemonic and stores it", async () => {
    await selfCustodialCreateWallet()

    expect(mockGenerateMnemonic).toHaveBeenCalledTimes(1)
    expect(mockSetMnemonic).toHaveBeenCalledWith(
      "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
    )
  })

  it("returns the generated mnemonic", async () => {
    const result = await selfCustodialCreateWallet()

    expect(result).toBe(
      "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
    )
  })

  it("connects to SDK and activates stable balance", async () => {
    await selfCustodialCreateWallet()

    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1)
  })

  it("disconnects SDK after activation", async () => {
    await selfCustodialCreateWallet()

    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it("disconnects even if updateUserSettings fails", async () => {
    mockUpdateUserSettings.mockRejectedValue(new Error("settings failed"))

    await expect(selfCustodialCreateWallet()).rejects.toThrow("settings failed")
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it("throws if mnemonic generation fails", async () => {
    mockGenerateMnemonic.mockReturnValue("")

    await expect(selfCustodialCreateWallet()).rejects.toThrow(
      "Failed to generate mnemonic",
    )
  })

  it("throws if keychain storage fails", async () => {
    mockSetMnemonic.mockResolvedValue(false)

    await expect(selfCustodialCreateWallet()).rejects.toThrow("Failed to store mnemonic")
  })
})

describe("selfCustodialRestoreWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetMnemonic.mockResolvedValue(true)
  })

  it("stores provided mnemonic", async () => {
    await selfCustodialRestoreWallet("restore word1 word2 word3")

    expect(mockSetMnemonic).toHaveBeenCalledWith("restore word1 word2 word3")
  })

  it("throws if keychain storage fails", async () => {
    mockSetMnemonic.mockResolvedValue(false)

    await expect(selfCustodialRestoreWallet("mnemonic")).rejects.toThrow(
      "Failed to store mnemonic",
    )
  })
})
