/* eslint-disable camelcase */
import {
  selfCustodialCreateWallet,
  selfCustodialRestoreWallet,
} from "@app/self-custodial/bridge"

const mockSetMnemonic = jest.fn()
const mockSetMnemonicNetwork = jest.fn()
const mockGenerateMnemonic = jest.fn()

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
  connect: jest.fn(),
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
    mockSetMnemonicNetwork.mockResolvedValue(true)
  })

  it("generates mnemonic and stores it", async () => {
    await selfCustodialCreateWallet()

    expect(mockGenerateMnemonic).toHaveBeenCalledTimes(1)
    expect(mockSetMnemonic).toHaveBeenCalledWith(
      "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
    )
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
