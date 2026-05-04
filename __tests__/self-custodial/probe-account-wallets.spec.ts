import { probeSelfCustodialAccountWallets } from "@app/self-custodial/probe-account-wallets"
import { WalletCurrency } from "@app/graphql/generated"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { toWalletId } from "@app/types/wallet.types"

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

  it("returns null and does not init the SDK when no mnemonic is stored", async () => {
    mockGetMnemonic.mockResolvedValue(null)

    const result = await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(result).toBeNull()
    expect(mockInitSdk).not.toHaveBeenCalled()
    expect(mockDisconnectSdk).not.toHaveBeenCalled()
  })

  it("connects with the account's mnemonic and storage dir, returns the snapshot wallets", async () => {
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
    expect(result).toEqual(sampleWallets)
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

  it("disconnects the SDK even when the snapshot fetch throws", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockResolvedValue(FAKE_SDK)
    mockGetSnapshot.mockRejectedValue(new Error("getInfo failed"))

    await expect(probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)).rejects.toThrow(
      "getInfo failed",
    )

    expect(mockDisconnectSdk).toHaveBeenCalledWith(FAKE_SDK)
  })

  it("propagates a connect failure without trying to disconnect", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockRejectedValue(new Error("connect failed"))

    await expect(probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)).rejects.toThrow(
      "connect failed",
    )

    expect(mockDisconnectSdk).not.toHaveBeenCalled()
  })

  it("swallows disconnect errors so the snapshot read still succeeds", async () => {
    mockGetMnemonic.mockResolvedValue(TEST_MNEMONIC)
    mockInitSdk.mockResolvedValue(FAKE_SDK)
    mockGetSnapshot.mockResolvedValue({
      wallets: sampleWallets,
      hasMore: false,
      rawTransactionCount: 0,
    })
    mockDisconnectSdk.mockRejectedValueOnce(new Error("disconnect failed"))

    const result = await probeSelfCustodialAccountWallets(TEST_ACCOUNT_ID)

    expect(result).toEqual(sampleWallets)
  })
})
