import { WalletCurrency } from "@app/graphql/generated"
import { detectBalanceStale } from "@app/self-custodial/providers/detect-balance-stale"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction.types"
import { toWalletId, type WalletState } from "@app/types/wallet.types"

const buildTx = (
  overrides: Partial<NormalizedTransaction> = {},
): NormalizedTransaction => ({
  id: "tx1",
  amount: { amount: 100, currency: WalletCurrency.Btc, currencyCode: WalletCurrency.Btc },
  direction: TransactionDirection.Receive,
  status: TransactionStatus.Completed,
  timestamp: 0,
  paymentType: PaymentType.Lightning,
  ...overrides,
})

const buildWallet = (overrides: Partial<WalletState> = {}): WalletState => ({
  id: toWalletId("btc"),
  walletCurrency: WalletCurrency.Btc,
  balance: { amount: 0, currency: WalletCurrency.Btc, currencyCode: WalletCurrency.Btc },
  transactions: [],
  ...overrides,
})

describe("detectBalanceStale", () => {
  it("returns false for an empty wallet list (no data yet)", () => {
    expect(detectBalanceStale([])).toBe(false)
  })

  it("returns true when balance=0 and at least one completed incoming tx exists", () => {
    const wallet = buildWallet({ transactions: [buildTx()] })
    expect(detectBalanceStale([wallet])).toBe(true)
  })

  it("returns false when balance is non-zero (even with incoming history)", () => {
    const wallet = buildWallet({
      balance: {
        amount: 500,
        currency: WalletCurrency.Btc,
        currencyCode: WalletCurrency.Btc,
      },
      transactions: [buildTx()],
    })
    expect(detectBalanceStale([wallet])).toBe(false)
  })

  it("returns false when balance=0 and history is empty (truly empty wallet)", () => {
    const wallet = buildWallet()
    expect(detectBalanceStale([wallet])).toBe(false)
  })

  it("returns false when balance=0 but history only has outgoing txs (user spent everything)", () => {
    const wallet = buildWallet({
      transactions: [buildTx({ direction: TransactionDirection.Send })],
    })
    expect(detectBalanceStale([wallet])).toBe(false)
  })

  it("ignores pending incoming txs (only completed ones count)", () => {
    const wallet = buildWallet({
      transactions: [buildTx({ status: TransactionStatus.Pending })],
    })
    expect(detectBalanceStale([wallet])).toBe(false)
  })

  it("checks across multiple wallets — any one matching triggers stale", () => {
    const empty = buildWallet({ id: toWalletId("btc") })
    const usdBtWithRx = buildWallet({
      id: toWalletId("usd"),
      walletCurrency: WalletCurrency.Usd,
      balance: {
        amount: 0,
        currency: WalletCurrency.Usd,
        currencyCode: WalletCurrency.Usd,
      },
      transactions: [buildTx()],
    })
    expect(detectBalanceStale([empty, usdBtWithRx])).toBe(true)
  })

  it("returns false when combined balance across wallets is non-zero", () => {
    const btc = buildWallet({ transactions: [buildTx()] })
    const usd = buildWallet({
      id: toWalletId("usd"),
      walletCurrency: WalletCurrency.Usd,
      balance: {
        amount: 1000,
        currency: WalletCurrency.Usd,
        currencyCode: WalletCurrency.Usd,
      },
    })
    expect(detectBalanceStale([btc, usd])).toBe(false)
  })
})
