/* eslint-disable camelcase */
jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
  BREEZ_NETWORK: "regtest",
}))

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test/documents",
}))

const mockConnect = jest.fn()
const mockUpdateUserSettings = jest.fn()
const mockDisconnect = jest.fn()
const mockAddEventListener = jest.fn()
const mockRemoveEventListener = jest.fn()

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  BitcoinNetwork: { Bitcoin: 0, Regtest: 4 },
  InputType_Tags: { SparkAddress: "SparkAddress" },
  Network: { Mainnet: 0, Regtest: 1 },
  Seed: {
    Mnemonic: jest
      .fn()
      .mockImplementation((args: unknown) => ({ tag: "Mnemonic", ...(args as object) })),
  },
  StableBalanceActiveLabel: {
    Set: jest.fn().mockImplementation((args: unknown) => ({ tag: "Set", inner: args })),
  },
  connect: (...args: unknown[]) => mockConnect(...args),
  defaultConfig: jest.fn().mockReturnValue({}),
  initLogging: jest.fn(),
}))

const mockGenerateMnemonic = jest.fn().mockReturnValue("word1 word2 word3")
const mockValidateMnemonic = jest.fn().mockReturnValue(true)
jest.mock("bip39", () => ({
  generateMnemonic: (...args: unknown[]) => mockGenerateMnemonic(...args),
  validateMnemonic: (...args: unknown[]) => mockValidateMnemonic(...args),
}))

jest.mock("react-native-quick-crypto", () => ({
  randomBytes: (size: number) => Buffer.alloc(size),
}))

const mockSetMnemonic = jest.fn()
const mockSetMnemonicNetwork = jest.fn()
const mockDeleteMnemonic = jest.fn()
jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    setMnemonicForAccount: (_id: string, ...args: unknown[]) => mockSetMnemonic(...args),
    setMnemonicNetworkForAccount: (_id: string, ...args: unknown[]) =>
      mockSetMnemonicNetwork(...args),
    deleteMnemonicForAccount: (..._args: unknown[]) => mockDeleteMnemonic(),
  },
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  addSelfCustodialAccountId: jest.fn().mockResolvedValue(undefined),
}))

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

jest.mock("@app/self-custodial/logging", () => ({
  createSdkLogListener: jest.fn().mockReturnValue({ log: jest.fn() }),
}))

import {
  addSdkEventListener,
  disconnectSdk,
  initSdk,
  removeSdkEventListener,
  selfCustodialCreateWallet,
  selfCustodialRestoreWallet,
} from "@app/self-custodial/bridge"

const makeSdk = () => ({
  updateUserSettings: (...args: unknown[]) => mockUpdateUserSettings(...args),
  disconnect: (...args: unknown[]) => mockDisconnect(...args),
  addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  removeEventListener: (...args: unknown[]) => mockRemoveEventListener(...args),
})

describe("initSdk", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("connects with the seed/config produced by the wallet config", async () => {
    const sdk = makeSdk()
    mockConnect.mockResolvedValue(sdk)

    const result = await initSdk("word1 word2 word3", "/test/storage")

    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: expect.objectContaining({ tag: "Mnemonic", mnemonic: "word1 word2 word3" }),
      }),
    )
    expect(result).toBe(sdk)
  })

  it("propagates connection errors from the SDK", async () => {
    mockConnect.mockRejectedValue(new Error("connect refused"))

    await expect(initSdk("word1 word2 word3", "/test/storage")).rejects.toThrow(
      "connect refused",
    )
  })
})

describe("disconnectSdk", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("delegates to sdk.disconnect()", async () => {
    const sdk = makeSdk()
    mockDisconnect.mockResolvedValue(undefined)

    await disconnectSdk(sdk as never)

    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })
})

describe("addSdkEventListener / removeSdkEventListener", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("addSdkEventListener forwards the onEvent callback", () => {
    const sdk = makeSdk()
    const onEvent = jest.fn()

    addSdkEventListener(sdk as never, onEvent)

    expect(mockAddEventListener).toHaveBeenCalledWith({ onEvent })
  })

  it("removeSdkEventListener forwards the listener id", () => {
    const sdk = makeSdk()

    removeSdkEventListener(sdk as never, "listener-1")

    expect(mockRemoveEventListener).toHaveBeenCalledWith("listener-1")
  })
})

describe("selfCustodialCreateWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetMnemonic.mockResolvedValue(true)
    mockSetMnemonicNetwork.mockResolvedValue(true)
    mockGenerateMnemonic.mockReturnValue("alpha beta gamma")
  })

  it("stores the mnemonic and the active network label for the given account", async () => {
    await selfCustodialCreateWallet("test-account")

    expect(mockSetMnemonic).toHaveBeenCalledWith("alpha beta gamma")
    expect(mockSetMnemonicNetwork).toHaveBeenCalledTimes(1)
  })

  it("throws when mnemonic generation produces an empty string", async () => {
    mockGenerateMnemonic.mockReturnValue("")

    await expect(selfCustodialCreateWallet("test-account")).rejects.toThrow(
      "Failed to generate mnemonic",
    )
    expect(mockSetMnemonic).not.toHaveBeenCalled()
  })

  it("throws when secure storage refuses to persist the mnemonic", async () => {
    mockSetMnemonic.mockResolvedValueOnce(false)

    await expect(selfCustodialCreateWallet("test-account")).rejects.toThrow(
      "Failed to store mnemonic",
    )
    expect(mockSetMnemonicNetwork).not.toHaveBeenCalled()
  })
})

describe("selfCustodialRestoreWallet (I14)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetMnemonic.mockResolvedValue(true)
    mockSetMnemonicNetwork.mockResolvedValue(true)
    mockDeleteMnemonic.mockResolvedValue(true)
    mockValidateMnemonic.mockReturnValue(true)
    const sdk = makeSdk()
    mockConnect.mockResolvedValue(sdk)
    mockDisconnect.mockResolvedValue(undefined)
  })

  it("trims/normalises whitespace before validating the mnemonic", async () => {
    await selfCustodialRestoreWallet("test-account", "  alpha   beta  gamma  ")

    expect(mockValidateMnemonic).toHaveBeenCalledWith("alpha beta gamma")
    expect(mockSetMnemonic).toHaveBeenCalledWith("alpha beta gamma")
  })

  it("normalises tabs and newlines before validating the mnemonic", async () => {
    await selfCustodialRestoreWallet("test-account", "\talpha\tbeta\ngamma\r\n")

    expect(mockValidateMnemonic).toHaveBeenCalledWith("alpha beta gamma")
    expect(mockSetMnemonic).toHaveBeenCalledWith("alpha beta gamma")
  })

  it("normalises mixed whitespace runs before validating the mnemonic", async () => {
    await selfCustodialRestoreWallet("test-account", "  alpha\t\tbeta \n gamma  ")

    expect(mockValidateMnemonic).toHaveBeenCalledWith("alpha beta gamma")
    expect(mockSetMnemonic).toHaveBeenCalledWith("alpha beta gamma")
  })

  it("throws and skips storage when BIP39 validation fails", async () => {
    mockValidateMnemonic.mockReturnValueOnce(false)

    await expect(
      selfCustodialRestoreWallet("test-account", "totally invalid"),
    ).rejects.toThrow("Invalid BIP39 mnemonic")

    expect(mockSetMnemonic).not.toHaveBeenCalled()
    expect(mockSetMnemonicNetwork).not.toHaveBeenCalled()
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it("stores the mnemonic and writes the active network label on success", async () => {
    await selfCustodialRestoreWallet("test-account", "provided mnemonic words")

    expect(mockSetMnemonic).toHaveBeenCalledWith("provided mnemonic words")
    expect(mockSetMnemonicNetwork).toHaveBeenCalledTimes(1)
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    expect(mockDeleteMnemonic).not.toHaveBeenCalled()
  })

  it("throws when secure storage refuses to persist the mnemonic", async () => {
    mockSetMnemonic.mockResolvedValueOnce(false)

    await expect(selfCustodialRestoreWallet("test-account", "any words")).rejects.toThrow(
      "Failed to store mnemonic",
    )
    expect(mockSetMnemonicNetwork).not.toHaveBeenCalled()
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it("rolls back the stored mnemonic and records the error when SDK init fails", async () => {
    mockConnect.mockRejectedValueOnce(new Error("SDK init refused"))

    await expect(
      selfCustodialRestoreWallet("test-account", "any valid words"),
    ).rejects.toThrow("SDK init refused")

    expect(mockSetMnemonic).toHaveBeenCalledTimes(1)
    expect(mockDeleteMnemonic).toHaveBeenCalledTimes(1)
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("SDK init refused") }),
    )
  })
})
