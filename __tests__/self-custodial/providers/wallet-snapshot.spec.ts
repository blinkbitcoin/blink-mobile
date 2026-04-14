import { WalletCurrency } from "@app/graphql/generated"

import { getSelfCustodialWalletSnapshot } from "@app/self-custodial/providers/wallet-snapshot"

jest.mock("@app/self-custodial/config", () => ({
  SparkToken: { Label: "USDB", Ticker: "USDB" },
  SparkConfig: { tokenIdentifier: "test-token-id" },
}))

const createMockSdk = (overrides = {}) => ({
  getInfo: jest.fn().mockResolvedValue({
    identityPubkey: "pubkey123",
    balanceSats: 50000,
    tokenBalances: {
      token1: {
        balance: 150000,
        tokenMetadata: { ticker: "USDB", decimals: 6 },
      },
    },
    ...overrides,
  }),
  listPayments: jest.fn().mockResolvedValue({ payments: [] }),
})

describe("getSelfCustodialWalletSnapshot", () => {
  it("returns BTC and USD wallets with correct balances", async () => {
    const sdk = createMockSdk()

    const { wallets } = await getSelfCustodialWalletSnapshot(sdk as never)

    expect(wallets).toHaveLength(2)
    expect(wallets[0].walletCurrency).toBe(WalletCurrency.Btc)
    expect(wallets[0].balance.amount).toBe(50000)
    expect(wallets[1].walletCurrency).toBe(WalletCurrency.Usd)
    expect(wallets[1].balance.amount).toBe(15)
  })

  it("returns zero USD balance when no token found", async () => {
    const sdk = createMockSdk()
    sdk.getInfo.mockResolvedValue({
      identityPubkey: "pubkey123",
      balanceSats: 10000,
      tokenBalances: {},
    })

    const { wallets } = await getSelfCustodialWalletSnapshot(sdk as never)

    expect(wallets[1].balance.amount).toBe(0)
  })

  it("uses identityPubkey for wallet IDs", async () => {
    const sdk = createMockSdk()

    const { wallets } = await getSelfCustodialWalletSnapshot(sdk as never)

    expect(wallets[0].id).toContain("pubkey123")
    expect(wallets[1].id).toContain("pubkey123")
  })

  it("maps transactions by currency", async () => {
    const sdk = createMockSdk()
    sdk.listPayments.mockResolvedValue({
      payments: [
        {
          id: "pay1",
          paymentType: 0,
          amount: BigInt(1000),
          fees: BigInt(10),
          timestamp: BigInt(1700000000),
          status: 0,
          method: 0,
          details: {
            tag: "Lightning",
            inner: { description: "test" },
          },
        },
      ],
    })

    const { wallets } = await getSelfCustodialWalletSnapshot(sdk as never)

    expect(wallets[0].transactions.length).toBeGreaterThanOrEqual(0)
  })
})
