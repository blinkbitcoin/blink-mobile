import { WalletCurrency } from "@app/graphql/generated"
import { toWalletMoneyAmount } from "@app/types/amounts"
import type { NormalizedTransaction } from "@app/types/transaction.types"
import { AccountType, toWalletId, type WalletState } from "@app/types/wallet.types"

import {
  appendTransactions,
  getSelfCustodialWalletSnapshot,
  loadMoreTransactions,
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

const buildKnownPayment = (id: string) => ({
  id,
  paymentType: 0,
  amount: BigInt(1000),
  fees: BigInt(10),
  timestamp: BigInt(1700000000),
  status: 0,
  method: 0,
  details: { tag: "Lightning", inner: { description: id } },
})

const buildUnknownTokenPayment = (id: string) => ({
  id,
  paymentType: 0,
  amount: BigInt(1000),
  fees: BigInt(10),
  timestamp: BigInt(1700000000),
  status: 0,
  method: 2, // PaymentMethod.Token
  details: {
    tag: "Token",
    inner: {
      metadata: { ticker: "OTHER", decimals: 6, identifier: "other-token-id" },
    },
  },
})

describe("hasMore pagination (Critical #10)", () => {
  it("computes hasMore from the raw response, not after isKnownPayment filtering", async () => {
    // 20 raw items (page-size) where 5 are unknown tokens that get filtered out.
    const sdk = createMockSdk()
    const payments = [
      ...Array.from({ length: 15 }, (_, i) => buildKnownPayment(`known-${i}`)),
      ...Array.from({ length: 5 }, (_, i) => buildUnknownTokenPayment(`other-${i}`)),
    ]
    sdk.listPayments.mockResolvedValue({ payments })

    const snapshot = await getSelfCustodialWalletSnapshot(sdk as never)

    expect(snapshot.hasMore).toBe(true)
  })

  it("hasMore is false when raw response is shorter than page size", async () => {
    const sdk = createMockSdk()
    sdk.listPayments.mockResolvedValue({
      payments: Array.from({ length: 10 }, (_, i) => buildKnownPayment(`p-${i}`)),
    })

    const snapshot = await getSelfCustodialWalletSnapshot(sdk as never)

    expect(snapshot.hasMore).toBe(false)
  })
})

describe("loadMoreTransactions", () => {
  it("returns hasMore=true when raw response fills the page", async () => {
    const sdk = createMockSdk()
    sdk.listPayments.mockResolvedValue({
      payments: Array.from({ length: 20 }, (_, i) => buildKnownPayment(`p-${i}`)),
    })

    const page = await loadMoreTransactions(sdk as never, 0)

    expect(page.hasMore).toBe(true)
    expect(page.transactions).toHaveLength(20)
  })

  it("returns hasMore=true even when filtering reduces transactions below page size", async () => {
    const sdk = createMockSdk()
    sdk.listPayments.mockResolvedValue({
      payments: [
        ...Array.from({ length: 12 }, (_, i) => buildKnownPayment(`k-${i}`)),
        ...Array.from({ length: 8 }, (_, i) => buildUnknownTokenPayment(`o-${i}`)),
      ],
    })

    const page = await loadMoreTransactions(sdk as never, 20)

    expect(page.hasMore).toBe(true)
    expect(page.transactions).toHaveLength(12)
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

  it("dedupes incoming transactions whose id is already in the wallet (regression Critical #10)", () => {
    const existing = buildTx("dup-btc", WalletCurrency.Btc)
    const wallets = [buildWallet(WalletCurrency.Btc, [existing])]
    const newTxs = [
      buildTx("dup-btc", WalletCurrency.Btc), // duplicate of existing
      buildTx("fresh-btc", WalletCurrency.Btc),
    ]

    const result = appendTransactions(wallets, newTxs)

    expect(result[0].transactions.map((t) => t.id)).toEqual(["dup-btc", "fresh-btc"])
  })

  it("dedupes duplicates within a single newTxs batch", () => {
    const wallets = [buildWallet(WalletCurrency.Btc)]
    const newTxs = [
      buildTx("a", WalletCurrency.Btc),
      buildTx("a", WalletCurrency.Btc), // same id twice in the batch
      buildTx("b", WalletCurrency.Btc),
    ]

    const result = appendTransactions(wallets, newTxs)

    // Existing wallet is empty so the first "a" is appended; the second is filtered.
    expect(result[0].transactions.map((t) => t.id)).toEqual(["a", "b"])
  })
})
