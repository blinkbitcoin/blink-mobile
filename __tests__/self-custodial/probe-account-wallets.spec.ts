import {
  probeSelfCustodialAccountWallets,
  ProbeAccountWalletsStatus,
} from "@app/self-custodial/probe-account-wallets"
import { WalletCurrency } from "@app/graphql/generated"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { toWalletId } from "@app/types/wallet"

const mockGetMnemonic = jest.fn()
jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonicForAccount: (...args: unknown[]) => mockGetMnemonic(...args),
  },
}))

const mockInitSdk = jest.fn()
const mockDisconnectSdk = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/self-custodial/bridge", () => ({
  initSdk: (...args: unknown[]) => mockInitSdk(...args),
  disconnectSdk: (...args: unknown[]) => mockDisconnectSdk(...args),
}))

const mockStorageDirFor = jest.fn((accountId: string) => `/storage/spark/${accountId}`)
jest.mock("@app/self-custodial/config", () => ({
  storageDirFor: (accountId: string) => mockStorageDirFor(accountId),
}))

const mockGetSnapshot = jest.fn()
jest.mock("@app/self-custodial/providers/wallet-snapshot", () => ({
  getSelfCustodialWalletSnapshot: (...args: unknown[]) => mockGetSnapshot(...args),
}))

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

const TEST_ACCOUNT_ID = "account-123"
const TEST_MNEMONIC = "abandon abandon abandon abandon abandon abandon"
const FAKE_SDK = { id: "sdk-instance" }

const sampleWallets = [
  {
    id: toWalletId("pubkey-btc"),
    walletCurrency: WalletCurrency.Btc,
    balance: toBtcMoneyAmount(522),
    transactions: [],
  },
  {
    id: toWalletId("pubkey-usd"),
    walletCurrency: WalletCurrency.Usd,
    balance: toUsdMoneyAmount(987),
    transactions: [],
  },
]

describe("probeSelfCustodialAccountWallets", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns no-mnemonic without initializing the SDK when no mnemonic is stored", async () => {
    mockGetMnemonic.mockResolvedValue(null)

    const result = await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(result).toEqual({ status: ProbeAccountWalletsStatus.NoMnemonic })
    expect(mockInitSdk).not.toHaveBeenCalled()
    expect(mockDisconnectSdk).not.toHaveBeenCalled()
  })

  it("connects with the account's mnemonic and storage dir, returns ok with snapshot wallets", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockResolvedValue(FAKE_SDK)
    mockGetSnapshot.mockResolvedValue({
      wallets: sampleWallets,
      hasMore: false,
      rawTransactionCount: 0,
    })

    const result = await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(mockInitSdk).toHaveBeenCalledWith(
      TEST_MNEMONIC,
      `/storage/spark/${TEST_ACCOUNT_ID}`,
    )
    expect(mockGetSnapshot).toHaveBeenCalledWith(FAKE_SDK)
    expect(result).toEqual({
      status: ProbeAccountWalletsStatus.Ok,
      wallets: sampleWallets,
    })
  })

  it("disconnects the SDK after a successful snapshot read", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockResolvedValue(FAKE_SDK)
    mockGetSnapshot.mockResolvedValue({
      wallets: sampleWallets,
      hasMore: false,
      rawTransactionCount: 0,
    })

    await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(mockDisconnectSdk).toHaveBeenCalledWith(FAKE_SDK)
  })

  it("returns probe-failed (not ok) when the snapshot fetch throws, but still disconnects the SDK (Critical #1)", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockResolvedValue(FAKE_SDK)
    mockGetSnapshot.mockRejectedValue(new Error("getInfo failed"))

    const result = await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(result.status).toBe(ProbeAccountWalletsStatus.ProbeFailed)
    if (result.status === ProbeAccountWalletsStatus.ProbeFailed) {
      expect(result.error.message).toBe("getInfo failed")
    }
    expect(mockDisconnectSdk).toHaveBeenCalledWith(FAKE_SDK)
  })

  it("returns probe-failed (not ok) when the connect step fails, and never attempts to disconnect (Critical #1)", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockRejectedValue(new Error("connect failed"))

    const result = await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(result.status).toBe(ProbeAccountWalletsStatus.ProbeFailed)
    if (result.status === ProbeAccountWalletsStatus.ProbeFailed) {
      expect(result.error.message).toBe("connect failed")
    }
    expect(mockDisconnectSdk).not.toHaveBeenCalled()
  })

  it("wraps a non-Error rejection from the snapshot fetch into an Error (Critical #1)", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockResolvedValue(FAKE_SDK)
    mockGetSnapshot.mockRejectedValue("opaque string failure")

    const result = await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(result.status).toBe(ProbeAccountWalletsStatus.ProbeFailed)
    if (result.status === ProbeAccountWalletsStatus.ProbeFailed) {
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toContain("opaque string failure")
    }
  })

  it("swallows disconnect errors so the snapshot read still resolves to ok", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockResolvedValue(FAKE_SDK)
    mockGetSnapshot.mockResolvedValue({
      wallets: sampleWallets,
      hasMore: false,
      rawTransactionCount: 0,
    })
    mockDisconnectSdk.mockRejectedValueOnce(new Error("disconnect failed"))

    const result = await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(result).toEqual({
      status: ProbeAccountWalletsStatus.Ok,
      wallets: sampleWallets,
    })
  })

  it("records the disconnect failure to crashlytics so leaking SDK instances are observable (Important #14)", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockResolvedValue(FAKE_SDK)
    mockGetSnapshot.mockResolvedValue({
      wallets: sampleWallets,
      hasMore: false,
      rawTransactionCount: 0,
    })
    const disconnectError = new Error("SQLite handle locked")
    mockDisconnectSdk.mockRejectedValueOnce(disconnectError)

    await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(mockRecordError).toHaveBeenCalledWith(disconnectError)
  })

  it("wraps a non-Error disconnect rejection into an Error before recording it (Important #14)", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockResolvedValue(FAKE_SDK)
    mockGetSnapshot.mockResolvedValue({
      wallets: sampleWallets,
      hasMore: false,
      rawTransactionCount: 0,
    })
    mockDisconnectSdk.mockRejectedValueOnce("native handle invalid")

    await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Probe SDK disconnect failed"),
      }),
    )
  })
})
