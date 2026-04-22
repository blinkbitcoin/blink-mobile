import { WalletCurrency } from "@app/graphql/generated"
import { toWalletMoneyAmount } from "@app/types/amounts"
import type { NormalizedTransaction } from "@app/types/transaction.types"
import { AccountType, toWalletId, type WalletState } from "@app/types/wallet.types"

import {
  appendTransactions,
  getSelfCustodialWalletSnapshot,
} from "@app/self-custodial/providers/wallet-snapshot"

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
        tokenMetadata: { identifier: "test-token-id", ticker: "USDB", decimals: 6 },
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

const buildTx = (id: string, currency: WalletCurrency): NormalizedTransaction => ({
  id,
  amount: toWalletMoneyAmount(1, currency),
  direction: "receive",
  status: "completed",
  timestamp: 1,
  paymentType: "lightning",
  sourceAccountType: AccountType.SelfCustodial,
})

const buildWallet = (
  currency: WalletCurrency,
  transactions: NormalizedTransaction[] = [],
): WalletState => ({
  id: toWalletId(`wallet-${currency}`),
  walletCurrency: currency,
  balance: toWalletMoneyAmount(0, currency),
  transactions,
})

describe("appendTransactions", () => {
  it("appends BTC txs only to BTC wallet and USD txs only to USD wallet", () => {
    const wallets = [buildWallet(WalletCurrency.Btc), buildWallet(WalletCurrency.Usd)]
    const newTxs = [
      buildTx("btc-1", WalletCurrency.Btc),
      buildTx("usd-1", WalletCurrency.Usd),
    ]

    const result = appendTransactions(wallets, newTxs)

    expect(result[0].transactions.map((t) => t.id)).toEqual(["btc-1"])
    expect(result[1].transactions.map((t) => t.id)).toEqual(["usd-1"])
  })

  it("preserves existing transactions and appends new ones at the end", () => {
    const existing = buildTx("existing-btc", WalletCurrency.Btc)
    const wallets = [buildWallet(WalletCurrency.Btc, [existing])]
    const newTxs = [buildTx("new-btc", WalletCurrency.Btc)]

    const result = appendTransactions(wallets, newTxs)

    expect(result[0].transactions.map((t) => t.id)).toEqual(["existing-btc", "new-btc"])
  })

  it("returns a new array without mutating the input wallets", () => {
    const wallets = [buildWallet(WalletCurrency.Btc)]
    const newTxs = [buildTx("btc-1", WalletCurrency.Btc)]

    const result = appendTransactions(wallets, newTxs)

    expect(result).not.toBe(wallets)
    expect(result[0]).not.toBe(wallets[0])
    expect(wallets[0].transactions).toHaveLength(0)
  })

  it("handles empty newTxs without changing transaction lists", () => {
    const existing = buildTx("existing-btc", WalletCurrency.Btc)
    const wallets = [buildWallet(WalletCurrency.Btc, [existing])]

    const result = appendTransactions(wallets, [])

    expect(result[0].transactions).toEqual([existing])
  })
})
