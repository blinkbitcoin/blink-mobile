/* eslint-disable camelcase */
import {
  selfCustodialCreateWallet,
  selfCustodialRestoreWallet,
} from "@app/self-custodial/bridge"

const mockSetMnemonic = jest.fn()
const mockSetMnemonicNetwork = jest.fn()
const mockDeleteMnemonic = jest.fn()
const mockGenerateMnemonic = jest.fn()
const mockConnect = jest.fn()
const mockDisconnect = jest.fn()
const mockUpdateUserSettings = jest.fn()
const mockRecordError = jest.fn()

jest.mock("bip39", () => ({
  generateMnemonic: (...args: unknown[]) => mockGenerateMnemonic(...args),
}))

jest.mock("react-native-quick-crypto", () => ({
  randomBytes: (size: number) => Buffer.alloc(size),
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  BitcoinNetwork: { Bitcoin: 0, Regtest: 4 },
  InputType_Tags: { SparkAddress: "SparkAddress" },
  Network: { Mainnet: 0, Regtest: 1 },
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
  BREEZ_NETWORK: "regtest",
}))

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test/documents",
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    setMnemonic: (...args: string[]) => mockSetMnemonic(...args),
    setMnemonicNetwork: (...args: string[]) => mockSetMnemonicNetwork(...args),
    deleteMnemonic: () => mockDeleteMnemonic(),
  },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: Error[]) => mockRecordError(...args),
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
    mockSetMnemonicNetwork.mockResolvedValue(true)
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

  it("connects to SDK and activates stable balance", async () => {
    await selfCustodialCreateWallet()

    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1)
  })

  it("disconnects SDK after activation", async () => {
    await selfCustodialCreateWallet()

    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it("deletes mnemonic and reports to crashlytics when SDK connect fails", async () => {
    mockConnect.mockRejectedValue(new Error("connect failed"))
    mockDeleteMnemonic.mockResolvedValue(true)

    await expect(selfCustodialCreateWallet()).rejects.toThrow("connect failed")

    expect(mockDeleteMnemonic).toHaveBeenCalledTimes(1)
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "connect failed" }),
    )
  })

  it("deletes mnemonic when updateUserSettings fails", async () => {
    mockUpdateUserSettings.mockRejectedValue(new Error("settings failed"))
    mockDeleteMnemonic.mockResolvedValue(true)

    await expect(selfCustodialCreateWallet()).rejects.toThrow("settings failed")

    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    expect(mockDeleteMnemonic).toHaveBeenCalledTimes(1)
    expect(mockRecordError).toHaveBeenCalledTimes(1)
  })

  it("throws in production builds", async () => {
    const original = (global as Record<string, unknown>).__DEV__
    ;(global as Record<string, unknown>).__DEV__ = false

    await expect(selfCustodialCreateWallet()).rejects.toThrow(
      "Wallet creation is disabled in production builds",
    )
    ;(global as Record<string, unknown>).__DEV__ = original
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

  it("stores network alongside mnemonic", async () => {
    await selfCustodialCreateWallet()

    expect(mockSetMnemonicNetwork).toHaveBeenCalledWith("regtest")
  })
})

describe("selfCustodialRestoreWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetMnemonic.mockResolvedValue(true)
    mockSetMnemonicNetwork.mockResolvedValue(true)
  })

  it("stores provided mnemonic and network", async () => {
    await selfCustodialRestoreWallet("restore word1 word2 word3")

    expect(mockSetMnemonic).toHaveBeenCalledWith("restore word1 word2 word3")
    expect(mockSetMnemonicNetwork).toHaveBeenCalledWith("regtest")
  })

  it("throws if keychain storage fails", async () => {
    mockSetMnemonic.mockResolvedValue(false)

    await expect(selfCustodialRestoreWallet("mnemonic")).rejects.toThrow(
      "Failed to store mnemonic",
    )
  })
})
