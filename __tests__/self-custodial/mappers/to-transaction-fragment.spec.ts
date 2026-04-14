import { TxDirection, TxStatus, WalletCurrency } from "@app/graphql/generated"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction.types"
import { AccountType } from "@app/types/wallet.types"

import {
  toTransactionFragment,
  toTransactionFragments,
} from "@app/self-custodial/mappers/to-transaction-fragment"

const createTx = (
  overrides: Partial<NormalizedTransaction> = {},
): NormalizedTransaction => ({
  id: "tx-1",
  amount: {
    amount: 1000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  },
  direction: TransactionDirection.Send,
  status: TransactionStatus.Completed,
  timestamp: 1700000000,
  paymentType: PaymentType.Lightning,
  sourceAccountType: AccountType.SelfCustodial,
  ...overrides,
})

describe("toTransactionFragment", () => {
  it("maps a basic send transaction", () => {
    const tx = createTx({
      fee: { amount: 10, currency: WalletCurrency.Btc, currencyCode: WalletCurrency.Btc },
    })
    const result = toTransactionFragment(tx)

    expect(result.__typename).toBe("Transaction")
    expect(result.id).toBe("tx-1")
    expect(result.direction).toBe(TxDirection.Send)
    expect(result.status).toBe(TxStatus.Success)
    expect(result.settlementAmount).toBe(-1010)
    expect(result.settlementFee).toBe(10)
    expect(result.settlementCurrency).toBe(WalletCurrency.Btc)
    expect(result.createdAt).toBe(1700000000)
  })

  it("maps a receive transaction with positive amount", () => {
    const tx = createTx({ direction: TransactionDirection.Receive })
    const result = toTransactionFragment(tx)

    expect(result.direction).toBe(TxDirection.Receive)
    expect(result.settlementAmount).toBe(1000)
  })

  it("maps pending status", () => {
    const tx = createTx({ status: TransactionStatus.Pending })
    const result = toTransactionFragment(tx)

    expect(result.status).toBe(TxStatus.Pending)
  })

  it("maps failed status", () => {
    const tx = createTx({ status: TransactionStatus.Failed })
    const result = toTransactionFragment(tx)

    expect(result.status).toBe(TxStatus.Failure)
  })

  it("handles zero fee", () => {
    const tx = createTx()
    const result = toTransactionFragment(tx)

    expect(result.settlementFee).toBe(0)
    expect(result.settlementAmount).toBe(-1000)
  })

  it("creates InitiationViaLn for Lightning payments", () => {
    const tx = createTx({ paymentType: PaymentType.Lightning })
    const result = toTransactionFragment(tx)

    expect(result.initiationVia.__typename).toBe("InitiationViaLn")
  })

  it("creates InitiationViaOnChain for Onchain payments", () => {
    const tx = createTx({ paymentType: PaymentType.Onchain })
    const result = toTransactionFragment(tx)

    expect(result.initiationVia.__typename).toBe("InitiationViaOnChain")
  })

  it("creates SettlementViaLn for Lightning payments", () => {
    const tx = createTx({ paymentType: PaymentType.Lightning })
    const result = toTransactionFragment(tx)

    expect(result.settlementVia.__typename).toBe("SettlementViaLn")
  })

  it("creates SettlementViaOnChain for Onchain payments", () => {
    const tx = createTx({ paymentType: PaymentType.Onchain })
    const result = toTransactionFragment(tx)

    expect(result.settlementVia.__typename).toBe("SettlementViaOnChain")
  })

  it("uses memo when no resolveDescription provided", () => {
    const tx = createTx({ memo: "test memo" })
    const result = toTransactionFragment(tx)

    expect(result.memo).toBe("test memo")
  })

  it("uses resolveDescription when provided", () => {
    const tx = createTx({ memo: "original" })
    const resolver = () => "resolved description"
    const result = toTransactionFragment(tx, undefined, resolver)

    expect(result.memo).toBe("resolved description")
  })

  it("returns null memo when no memo and no resolver", () => {
    const tx = createTx()
    const result = toTransactionFragment(tx)

    expect(result.memo).toBeNull()
  })

  it("uses BTCSAT currencyUnit for BTC", () => {
    const tx = createTx()
    const result = toTransactionFragment(tx)

    expect(result.settlementPrice.currencyUnit).toBe("BTCSAT")
  })

  it("uses USDCENT currencyUnit for USD", () => {
    const tx = createTx({
      amount: {
        amount: 100,
        currency: WalletCurrency.Usd,
        currencyCode: WalletCurrency.Usd,
      },
    })
    const result = toTransactionFragment(tx)

    expect(result.settlementPrice.currencyUnit).toBe("USDCENT")
  })

  it("computes display amounts without display info", () => {
    const tx = createTx()
    const result = toTransactionFragment(tx)

    expect(result.settlementDisplayAmount).toBe("1000")
    expect(result.settlementDisplayCurrency).toBe(WalletCurrency.Btc)
  })

  it("computes display amounts with display info", () => {
    const tx = createTx()
    const display = {
      displayCurrency: "USD",
      convertMoneyAmount: jest.fn().mockReturnValue({
        amount: 5000,
        currency: "USD",
        currencyCode: "USD",
      }),
      fractionDigits: 2,
    }
    const result = toTransactionFragment(tx, display)

    expect(result.settlementDisplayCurrency).toBe("USD")
    expect(display.convertMoneyAmount).toHaveBeenCalled()
  })
})

describe("toTransactionFragments", () => {
  it("maps an array of transactions", () => {
    const txs = [createTx({ id: "tx-1" }), createTx({ id: "tx-2" })]
    const results = toTransactionFragments(txs)

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe("tx-1")
    expect(results[1].id).toBe("tx-2")
  })
})
