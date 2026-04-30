/* eslint-disable camelcase */
import {
  selfCustodialCreateWallet,
  selfCustodialRestoreWallet,
} from "@app/self-custodial/bridge"

const mockSetMnemonicForAccount = jest.fn()
const mockSetMnemonicNetworkForAccount = jest.fn()
const mockDeleteMnemonicForAccount = jest.fn()
const mockGenerateMnemonic = jest.fn()
const mockConnect = jest.fn()
const mockDisconnect = jest.fn()
const mockUpdateUserSettings = jest.fn()
const mockRecordError = jest.fn()

jest.mock("bip39", () => ({
  generateMnemonic: (...args: unknown[]) => mockGenerateMnemonic(...args),
  validateMnemonic: jest.fn().mockReturnValue(true),
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
    setMnemonicForAccount: (...args: string[]) => mockSetMnemonicForAccount(...args),
    setMnemonicNetworkForAccount: (...args: string[]) =>
      mockSetMnemonicNetworkForAccount(...args),
    deleteMnemonicForAccount: (...args: string[]) =>
      mockDeleteMnemonicForAccount(...args),
  },
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  addSelfCustodialAccountId: jest.fn(),
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
    mockSetMnemonicForAccount.mockResolvedValue(true)
    mockSetMnemonicNetworkForAccount.mockResolvedValue(true)
  })

  it("generates mnemonic and stores it", async () => {
    await selfCustodialCreateWallet("test-account-id")

    expect(mockGenerateMnemonic).toHaveBeenCalledTimes(1)
    expect(mockSetMnemonicForAccount).toHaveBeenCalledWith(
      "test-account-id",
      "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
    )
  })

  it("does not connect to the SDK or touch user settings during creation", async () => {
    await selfCustodialCreateWallet("test-account-id")

    expect(mockConnect).not.toHaveBeenCalled()
    expect(mockUpdateUserSettings).not.toHaveBeenCalled()
    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it("throws if mnemonic generation fails", async () => {
    mockGenerateMnemonic.mockReturnValue("")

    await expect(selfCustodialCreateWallet("test-account-id")).rejects.toThrow(
      "Failed to generate mnemonic",
    )
  })

  it("throws if keychain storage fails", async () => {
    mockSetMnemonicForAccount.mockResolvedValue(false)

    await expect(selfCustodialCreateWallet("test-account-id")).rejects.toThrow(
      "Failed to store mnemonic",
    )
  })

  it("stores network alongside mnemonic", async () => {
    await selfCustodialCreateWallet("test-account-id")

    expect(mockSetMnemonicNetworkForAccount).toHaveBeenCalledWith(
      "test-account-id",
      "regtest",
    )
  })
})

describe("selfCustodialRestoreWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetMnemonicForAccount.mockResolvedValue(true)
    mockSetMnemonicNetworkForAccount.mockResolvedValue(true)
    mockConnect.mockResolvedValue({ disconnect: jest.fn().mockResolvedValue(undefined) })
  })

  it("stores provided mnemonic and network", async () => {
    await selfCustodialRestoreWallet("test-account-id", "restore word1 word2 word3")

    expect(mockSetMnemonicForAccount).toHaveBeenCalledWith(
      "test-account-id",
      "restore word1 word2 word3",
    )
    expect(mockSetMnemonicNetworkForAccount).toHaveBeenCalledWith(
      "test-account-id",
      "regtest",
    )
  })

  it("throws if keychain storage fails", async () => {
    mockSetMnemonicForAccount.mockResolvedValue(false)

    await expect(
      selfCustodialRestoreWallet("test-account-id", "mnemonic"),
    ).rejects.toThrow("Failed to store mnemonic")
  })
})
