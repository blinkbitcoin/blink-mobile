/* eslint-disable camelcase */
import { Network } from "@breeztech/breez-sdk-spark-react-native"

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

const mockRecoverLnurlServerMode = jest.fn()
jest.mock("@app/self-custodial/lnurl-server-mode", () => ({
  recoverLnurlServerMode: (...args: unknown[]) => mockRecoverLnurlServerMode(...args),
}))

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
  SdkError_Tags: {
    InsufficientFunds: "InsufficientFunds",
    MaxDepositClaimFeeExceeded: "MaxDepositClaimFeeExceeded",
    NetworkError: "NetworkError",
    ChainServiceError: "ChainServiceError",
    InvalidInput: "InvalidInput",
    InvalidUuid: "InvalidUuid",
    LnurlError: "LnurlError",
    MissingUtxo: "MissingUtxo",
    StorageError: "StorageError",
    Signer: "Signer",
    SparkError: "SparkError",
    Generic: "Generic",
  },
  StableBalanceActiveLabel: {
    Set: jest.fn().mockImplementation((args) => ({ tag: "Set", inner: args })),
  },
  MaxFee: {
    NetworkRecommended: jest
      .fn()
      .mockImplementation((inner) => ({ tag: "NetworkRecommended", inner })),
    Fixed: jest.fn().mockImplementation((inner) => ({ tag: "Fixed", inner })),
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
  log: jest.fn(),
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
    await selfCustodialCreateWallet("test-account-id", Network.Regtest)

    expect(mockGenerateMnemonic).toHaveBeenCalledTimes(1)
    expect(mockSetMnemonicForAccount).toHaveBeenCalledWith(
      "test-account-id",
      "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
    )
  })

  it("does not connect to the SDK or touch user settings during creation", async () => {
    await selfCustodialCreateWallet("test-account-id", Network.Regtest)

    expect(mockConnect).not.toHaveBeenCalled()
    expect(mockUpdateUserSettings).not.toHaveBeenCalled()
    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it("throws if mnemonic generation fails", async () => {
    mockGenerateMnemonic.mockReturnValue("")

    await expect(
      selfCustodialCreateWallet("test-account-id", Network.Regtest),
    ).rejects.toThrow("Failed to generate mnemonic")
  })

  it("throws if keychain storage fails", async () => {
    mockSetMnemonicForAccount.mockResolvedValue(false)

    await expect(
      selfCustodialCreateWallet("test-account-id", Network.Regtest),
    ).rejects.toThrow("Failed to store mnemonic")
  })

  it("stores network alongside mnemonic", async () => {
    await selfCustodialCreateWallet("test-account-id", Network.Regtest)

    expect(mockSetMnemonicNetworkForAccount).toHaveBeenCalledWith(
      "test-account-id",
      "regtest",
    )
  })
})

describe("selfCustodialRestoreWallet", () => {
  const restoreWallet = () =>
    selfCustodialRestoreWallet({
      accountId: "test-account-id",
      mnemonic: "restore word1 word2 word3",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
    })

  beforeEach(() => {
    jest.clearAllMocks()
    mockSetMnemonicForAccount.mockResolvedValue(true)
    mockSetMnemonicNetworkForAccount.mockResolvedValue(true)
    mockConnect.mockResolvedValue({ disconnect: jest.fn().mockResolvedValue(undefined) })
    mockRecoverLnurlServerMode.mockResolvedValue(null)
  })

  it("stores provided mnemonic and network", async () => {
    await selfCustodialRestoreWallet({
      accountId: "test-account-id",
      mnemonic: "restore word1 word2 word3",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
    })

    expect(mockSetMnemonicForAccount).toHaveBeenCalledWith(
      "test-account-id",
      "restore word1 word2 word3",
    )
    expect(mockSetMnemonicNetworkForAccount).toHaveBeenCalledWith(
      "test-account-id",
      "regtest",
    )
  })

  /** Read while the wallet is connected and able to sign, the one moment the restore
   *  has. */
  it("hands back the mode the LNURL server already holds", async () => {
    mockRecoverLnurlServerMode.mockResolvedValue("anon")

    expect(await restoreWallet()).toEqual({ serverMode: "anon", isServerModeKnown: true })
  })

  it("hands back no mode when the server holds none", async () => {
    expect(await restoreWallet()).toEqual({ serverMode: null, isServerModeKnown: true })
  })

  /** The wallet itself is whole; an unreachable server must not undo a restore that
   *  otherwise succeeded. */
  it("completes the restore when the mode cannot be recovered", async () => {
    mockRecoverLnurlServerMode.mockRejectedValue(new Error("server down"))

    expect(await restoreWallet()).toEqual({ serverMode: null, isServerModeKnown: false })
    expect(mockDeleteMnemonicForAccount).not.toHaveBeenCalled()
  })

  /** An unanswered server is not the server answering "none": a stored Anon may be
   *  sitting behind it, and reporting none would push it away. */
  it("marks the mode as unknown rather than absent when the server never answered", async () => {
    mockRecoverLnurlServerMode.mockRejectedValue(new Error("server down"))

    expect((await restoreWallet()).isServerModeKnown).toBe(false)
  })

  it("throws if keychain storage fails", async () => {
    mockSetMnemonicForAccount.mockResolvedValue(false)

    await expect(
      selfCustodialRestoreWallet({
        accountId: "test-account-id",
        mnemonic: "mnemonic",
        network: Network.Regtest,
        leewaySatPerVbyte: 1,
      }),
    ).rejects.toThrow("Failed to store mnemonic")
  })
})
