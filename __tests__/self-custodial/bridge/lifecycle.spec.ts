/* eslint-disable camelcase */
const mockConfig: Record<string, string | undefined> = {
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
}
jest.mock("react-native-config", () => mockConfig)

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test/documents",
}))

const mockConnect = jest.fn()
/** A fresh object per call: the config is mutated, and a shared one would carry the last
 *  network's Stable Balance into the next test. */
const mockDefaultConfig = jest.fn().mockImplementation(() => ({}))
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
    Set: jest.fn().mockImplementation((args: unknown) => ({ tag: "Set", inner: args })),
  },
  MaxFee: { create: (p: Record<string, unknown>) => p },
  MaxOnchainFee: {
    NetworkRecommended: jest
      .fn()
      .mockImplementation((inner: unknown) => ({ tag: "NetworkRecommended", inner })),
    Fixed: jest.fn().mockImplementation((inner: unknown) => ({ tag: "Fixed", inner })),
  },
  connect: (...args: unknown[]) => mockConnect(...args),
  defaultConfig: (...args: unknown[]) => mockDefaultConfig(...args),
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
  log: jest.fn(),
}))

jest.mock("@app/self-custodial/logging", () => ({
  createSdkLogListener: jest.fn().mockReturnValue({ log: jest.fn() }),
}))

import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  addSdkEventListener,
  disconnectSdk,
  initSdk,
  removeSdkEventListener,
  selfCustodialCreateWallet,
  selfCustodialRestoreWallet,
} from "@app/self-custodial/bridge"
import { sparkTokenIdentifier } from "@app/self-custodial/config"

/** Threaded explicitly since the config functions stopped reading a global; the real
 *  value comes from `useLnurlServer()` at the calling hook. */
const TEST_LNURL_DOMAIN = "staging.blink.sv"
const TEST_LNURL_SERVER = {
  serverUrl: `https://${TEST_LNURL_DOMAIN}`,
  domain: TEST_LNURL_DOMAIN,
}

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

    const result = await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })

    expect(mockDefaultConfig).toHaveBeenCalledWith(Network.Regtest)
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: expect.objectContaining({ tag: "Mnemonic", mnemonic: "word1 word2 word3" }),
        config: expect.objectContaining({
          apiKey: "test-api-key",
          lnurlDomain: "staging.blink.sv",
        }),
      }),
    )
    expect(result).toBe(sdk)
  })

  /**
   * The field is the SDK's to default, and it is pinned here instead: the exit-chain pass
   * is what the recovery backup needs collected. The mock hands back the opposite so the
   * assertion fails if the pin is dropped rather than passing on an inherited value.
   */
  it("pins the exit-chain collection over the SDK default", async () => {
    mockDefaultConfig.mockReturnValueOnce({
      exitChainAutoFetchEnabled: false,
    })
    mockConnect.mockResolvedValue(makeSdk())

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })

    const { config } = mockConnect.mock.calls[0][0]
    expect(config.exitChainAutoFetchEnabled).toBe(true)
  })

  it("caps the automatic deposit claim fee at the network-recommended rate plus leeway", async () => {
    mockConnect.mockResolvedValue(makeSdk())

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          maxDepositClaimFee: {
            onchain: {
              tag: "NetworkRecommended",
              inner: { leewaySatPerVbyte: 1n },
            },
          },
        }),
      }),
    )
  })

  it("configures Stable Balance with the mainnet token on mainnet", async () => {
    mockConnect.mockResolvedValue(makeSdk())

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Mainnet,
      leewaySatPerVbyte: 1,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })

    const { config } = mockConnect.mock.calls[0][0]
    expect(config.stableBalanceConfig).toEqual({
      tokens: [{ label: "USDB", tokenIdentifier: "test-token-id" }],
      defaultActiveLabel: undefined,
      thresholdSats: undefined,
      maxSlippageBps: 50,
    })
  })

  /** 0.27 rejects the mainnet USDB id on regtest, which is what kept Staging from starting. */
  it("leaves Stable Balance out on regtest when the build names no regtest token", async () => {
    mockConnect.mockResolvedValue(makeSdk())

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })

    const { config } = mockConnect.mock.calls[0][0]
    expect(config).not.toHaveProperty("stableBalanceConfig")
  })

  it("configures Stable Balance with the regtest token a build names", async () => {
    mockConfig.SPARK_REGTEST_TOKEN_IDENTIFIER = "btknrt1-test"
    mockConnect.mockResolvedValue(makeSdk())

    try {
      await initSdk({
        mnemonic: "word1 word2 word3",
        storageDir: "/test/storage",
        network: Network.Regtest,
        leewaySatPerVbyte: 1,
        lnurlDomain: TEST_LNURL_DOMAIN,
      })
    } finally {
      delete mockConfig.SPARK_REGTEST_TOKEN_IDENTIFIER
    }

    const { config } = mockConnect.mock.calls[0][0]
    expect(config.stableBalanceConfig).toEqual(
      expect.objectContaining({
        tokens: [{ label: "USDB", tokenIdentifier: "btknrt1-test" }],
      }),
    )
  })

  /** The bridge and mappers read the token without being handed the network. */
  it("points the token lookups at the network it connected to", async () => {
    mockConnect.mockResolvedValue(makeSdk())

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })
    expect(sparkTokenIdentifier()).toBeNull()

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Mainnet,
      leewaySatPerVbyte: 1,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })
    expect(sparkTokenIdentifier()).toBe("test-token-id")
  })

  it("routes the SDK through no proxy, matching the status call", async () => {
    mockConnect.mockResolvedValue(makeSdk())

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })

    const { config } = mockConnect.mock.calls[0][0]
    expect(config).toHaveProperty("proxy", undefined)
  })

  it("uses the provided leeway for the deposit claim fee cap", async () => {
    mockConnect.mockResolvedValue(makeSdk())

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Regtest,
      leewaySatPerVbyte: 3,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          maxDepositClaimFee: {
            onchain: {
              tag: "NetworkRecommended",
              inner: { leewaySatPerVbyte: 3n },
            },
          },
        }),
      }),
    )
  })

  it("truncates a fractional leeway so BigInt does not throw on it", async () => {
    mockConnect.mockResolvedValue(makeSdk())

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Regtest,
      leewaySatPerVbyte: 2.9,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          maxDepositClaimFee: {
            onchain: {
              tag: "NetworkRecommended",
              inner: { leewaySatPerVbyte: 2n },
            },
          },
        }),
      }),
    )
  })

  it("clamps a negative leeway to zero", async () => {
    mockConnect.mockResolvedValue(makeSdk())

    await initSdk({
      mnemonic: "word1 word2 word3",
      storageDir: "/test/storage",
      network: Network.Regtest,
      leewaySatPerVbyte: -5,
      lnurlDomain: TEST_LNURL_DOMAIN,
    })

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          maxDepositClaimFee: {
            onchain: {
              tag: "NetworkRecommended",
              inner: { leewaySatPerVbyte: 0n },
            },
          },
        }),
      }),
    )
  })

  it("propagates connection errors from the SDK", async () => {
    mockConnect.mockRejectedValue(new Error("connect refused"))

    await expect(
      initSdk({
        mnemonic: "word1 word2 word3",
        storageDir: "/test/storage",
        network: Network.Regtest,
        leewaySatPerVbyte: 1,
        lnurlDomain: TEST_LNURL_DOMAIN,
      }),
    ).rejects.toThrow("connect refused")
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
    await selfCustodialCreateWallet("test-account", Network.Regtest)

    expect(mockSetMnemonic).toHaveBeenCalledWith("alpha beta gamma")
    expect(mockSetMnemonicNetwork).toHaveBeenCalledTimes(1)
  })

  it("throws when mnemonic generation produces an empty string", async () => {
    mockGenerateMnemonic.mockReturnValue("")

    await expect(
      selfCustodialCreateWallet("test-account", Network.Regtest),
    ).rejects.toThrow("Failed to generate mnemonic")
    expect(mockSetMnemonic).not.toHaveBeenCalled()
  })

  it("throws when secure storage refuses to persist the mnemonic", async () => {
    mockSetMnemonic.mockResolvedValueOnce(false)

    await expect(
      selfCustodialCreateWallet("test-account", Network.Regtest),
    ).rejects.toThrow("Failed to store mnemonic")
    expect(mockSetMnemonicNetwork).not.toHaveBeenCalled()
  })

  it("deletes the stored phrase and rethrows when the network label write reports failure", async () => {
    mockSetMnemonicNetwork.mockResolvedValueOnce(false)

    await expect(
      selfCustodialCreateWallet("test-account", Network.Regtest),
    ).rejects.toThrow("Failed to store mnemonic network")
    expect(mockDeleteMnemonic).toHaveBeenCalledTimes(1)
    /** The hook owns the single crashlytics report now, so the bridge does not double-report. */
    expect(mockRecordError).not.toHaveBeenCalled()
  })
})

describe("selfCustodialRestoreWallet", () => {
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
    await selfCustodialRestoreWallet({
      accountId: "test-account",
      mnemonic: "  alpha   beta  gamma  ",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlServer: TEST_LNURL_SERVER,
    })

    expect(mockValidateMnemonic).toHaveBeenCalledWith("alpha beta gamma")
    expect(mockSetMnemonic).toHaveBeenCalledWith("alpha beta gamma")
  })

  it("normalises tabs and newlines before validating the mnemonic", async () => {
    await selfCustodialRestoreWallet({
      accountId: "test-account",
      mnemonic: "\talpha\tbeta\ngamma\r\n",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlServer: TEST_LNURL_SERVER,
    })

    expect(mockValidateMnemonic).toHaveBeenCalledWith("alpha beta gamma")
    expect(mockSetMnemonic).toHaveBeenCalledWith("alpha beta gamma")
  })

  it("normalises mixed whitespace runs before validating the mnemonic", async () => {
    await selfCustodialRestoreWallet({
      accountId: "test-account",
      mnemonic: "  alpha\t\tbeta \n gamma  ",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlServer: TEST_LNURL_SERVER,
    })

    expect(mockValidateMnemonic).toHaveBeenCalledWith("alpha beta gamma")
    expect(mockSetMnemonic).toHaveBeenCalledWith("alpha beta gamma")
  })

  it("throws and skips storage when BIP39 validation fails", async () => {
    mockValidateMnemonic.mockReturnValueOnce(false)

    await expect(
      selfCustodialRestoreWallet({
        accountId: "test-account",
        mnemonic: "totally invalid",
        network: Network.Regtest,
        leewaySatPerVbyte: 1,
        lnurlServer: TEST_LNURL_SERVER,
      }),
    ).rejects.toThrow("Invalid BIP39 mnemonic")

    expect(mockSetMnemonic).not.toHaveBeenCalled()
    expect(mockSetMnemonicNetwork).not.toHaveBeenCalled()
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it("stores the mnemonic and writes the active network label on success", async () => {
    await selfCustodialRestoreWallet({
      accountId: "test-account",
      mnemonic: "provided mnemonic words",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      lnurlServer: TEST_LNURL_SERVER,
    })

    expect(mockSetMnemonic).toHaveBeenCalledWith("provided mnemonic words")
    expect(mockSetMnemonicNetwork).toHaveBeenCalledTimes(1)
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    expect(mockDeleteMnemonic).not.toHaveBeenCalled()
  })

  it("throws when secure storage refuses to persist the mnemonic", async () => {
    mockSetMnemonic.mockResolvedValueOnce(false)

    await expect(
      selfCustodialRestoreWallet({
        accountId: "test-account",
        mnemonic: "any words",
        network: Network.Regtest,
        leewaySatPerVbyte: 1,
        lnurlServer: TEST_LNURL_SERVER,
      }),
    ).rejects.toThrow("Failed to store mnemonic")
    expect(mockSetMnemonicNetwork).not.toHaveBeenCalled()
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it("deletes the stored phrase when the network label write reports failure", async () => {
    mockSetMnemonicNetwork.mockResolvedValueOnce(false)

    await expect(
      selfCustodialRestoreWallet({
        accountId: "test-account",
        mnemonic: "any valid words",
        network: Network.Regtest,
        leewaySatPerVbyte: 1,
        lnurlServer: TEST_LNURL_SERVER,
      }),
    ).rejects.toThrow("Failed to store mnemonic network")
    expect(mockDeleteMnemonic).toHaveBeenCalledTimes(1)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it("rolls back the stored mnemonic and records the error when SDK init fails", async () => {
    mockConnect.mockRejectedValueOnce(new Error("SDK init refused"))

    await expect(
      selfCustodialRestoreWallet({
        accountId: "test-account",
        mnemonic: "any valid words",
        network: Network.Regtest,
        leewaySatPerVbyte: 1,
        lnurlServer: TEST_LNURL_SERVER,
      }),
    ).rejects.toThrow("SDK init refused")

    expect(mockSetMnemonic).toHaveBeenCalledTimes(1)
    expect(mockDeleteMnemonic).toHaveBeenCalledTimes(1)
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("SDK init refused") }),
    )
  })
})
