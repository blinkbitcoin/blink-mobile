import { WalletCurrency } from "@app/graphql/generated"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction"

import { mapCustodialWalletToWalletState } from "@app/custodial/adapters/wallet"

describe("mapCustodialWalletToWalletState", () => {
  const mockTransactions: NormalizedTransaction[] = []

  it("maps a BTC wallet correctly", () => {
    const wallet = {
      id: "btc-wallet-id",
      walletCurrency: WalletCurrency.Btc,
      balance: 50000,
    }

    const result = mapCustodialWalletToWalletState(wallet, mockTransactions)

    expect(result.id).toBe("btc-wallet-id")
    expect(result.walletCurrency).toBe(WalletCurrency.Btc)
    expect(result.balance.amount).toBe(50000)
    expect(result.balance.currency).toBe(WalletCurrency.Btc)
    expect(result.transactions).toBe(mockTransactions)
    expect(result.pendingBalance).toBeUndefined()
  })

  it("maps a USD wallet correctly", () => {
    const wallet = {
      id: "usd-wallet-id",
      walletCurrency: WalletCurrency.Usd,
      balance: 1500,
    }

    const result = mapCustodialWalletToWalletState(wallet, mockTransactions)

    expect(result.id).toBe("usd-wallet-id")
    expect(result.walletCurrency).toBe(WalletCurrency.Usd)
    expect(result.balance.amount).toBe(1500)
    expect(result.balance.currency).toBe(WalletCurrency.Usd)
  })

  it("attaches provided transactions", () => {
    const txs: NormalizedTransaction[] = [
      {
        id: "tx-1",
        amount: { amount: 100, currency: WalletCurrency.Btc, currencyCode: "BTC" },
        direction: TransactionDirection.Send,
        status: TransactionStatus.Completed,
        timestamp: 1700000000,
        paymentType: PaymentType.Lightning,
      },
    ]

    const wallet = {
      id: "btc-wallet-id",
      walletCurrency: WalletCurrency.Btc,
      balance: 100,
    }

    const result = mapCustodialWalletToWalletState(wallet, txs)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].id).toBe("tx-1")
  })
})
