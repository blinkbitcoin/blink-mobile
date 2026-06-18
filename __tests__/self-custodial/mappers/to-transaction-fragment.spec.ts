import { TxDirection, TxStatus, WalletCurrency } from "@app/graphql/generated"
import { DisplayCurrency } from "@app/types/amounts"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction"
import { AccountType } from "@app/types/wallet"

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

  it("converts the BTC fee separately from the USD settlement amount on a token tx (mixed-unit guard)", () => {
    const tx = createTx({
      paymentType: PaymentType.Lightning,
      amount: {
        amount: 500, // 500 USD cents = $5
        currency: WalletCurrency.Usd,
        currencyCode: WalletCurrency.Usd,
      },
      fee: {
        amount: 12, // 12 sats — must NOT be treated as 12 USD cents
        currency: WalletCurrency.Btc,
        currencyCode: WalletCurrency.Btc,
      },
    })

    const convertMoneyAmount = jest.fn(({ amount, currency }) => {
      // Stub conversion: USD cents pass through, BTC sats become 1 cent
      // regardless of amount. The point is to verify the input we pass.
      if (currency === WalletCurrency.Usd) {
        return { amount, currency: "USD", currencyCode: "USD" }
      }
      return { amount: 1, currency: "USD", currencyCode: "USD" }
    })

    toTransactionFragment(tx, {
      displayCurrency: "USD",
      convertMoneyAmount: convertMoneyAmount as never,
      fractionDigits: 2,
    })

    // The BTC fee is converted via convertMoneyAmount with currency: BTC — never
    // mixed in raw with the USD settlement amount. That's the mixed-unit guard.
    expect(convertMoneyAmount).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 12,
        currency: WalletCurrency.Btc,
        currencyCode: WalletCurrency.Btc,
      }),
      DisplayCurrency,
    )
    // The settlement amount stays in USD cents for the display conversion.
    expect(convertMoneyAmount).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 501,
        currency: WalletCurrency.Usd,
        currencyCode: WalletCurrency.Usd,
      }),
      DisplayCurrency,
    )
  })

  const currencyCodes = ["USD", "EUR", "GBP", "JPY"]
  currencyCodes.forEach((currencyCode) => {
    it(`always converts to the DisplayCurrency literal regardless of the displayCurrency code (${currencyCode})`, () => {
      const tx = createTx()
      const convertMoneyAmount = jest.fn().mockReturnValue({
        amount: 100,
        currency: DisplayCurrency,
        currencyCode,
      })

      toTransactionFragment(tx, {
        displayCurrency: currencyCode,
        convertMoneyAmount: convertMoneyAmount as never,
        fractionDigits: 2,
      })

      const calls = convertMoneyAmount.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      calls.forEach(([, toCurrency]) => {
        expect(toCurrency).toBe(DisplayCurrency)
      })
    })
  })

  it("produces a numeric settlementDisplayAmount for a non-USD displayCurrency (no NaN)", () => {
    const tx = createTx({ direction: TransactionDirection.Receive })
    const convertMoneyAmount = jest.fn().mockReturnValue({
      amount: 79, // EUR cents
      currency: DisplayCurrency,
      currencyCode: "EUR",
    })

    const result = toTransactionFragment(tx, {
      displayCurrency: "EUR",
      convertMoneyAmount: convertMoneyAmount as never,
      fractionDigits: 2,
    })

    expect(result.settlementDisplayAmount).toBe("0.79")
    expect(Number.isNaN(Number(result.settlementDisplayAmount))).toBe(false)
  })

  it("preserves the displayCurrency code in settlementDisplayCurrency for non-USD", () => {
    const tx = createTx()
    const convertMoneyAmount = jest.fn().mockReturnValue({
      amount: 100,
      currency: DisplayCurrency,
      currencyCode: "EUR",
    })

    const result = toTransactionFragment(tx, {
      displayCurrency: "EUR",
      convertMoneyAmount: convertMoneyAmount as never,
      fractionDigits: 2,
    })

    expect(result.settlementDisplayCurrency).toBe("EUR")
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

  it("keeps a USD fee in raw cents when settlementCurrency is USD instead of converting it through BTC pricing", () => {
    const tx = createTx({
      direction: TransactionDirection.Send,
      paymentType: PaymentType.Lightning,
      amount: {
        amount: 500,
        currency: WalletCurrency.Usd,
        currencyCode: WalletCurrency.Usd,
      },
      fee: {
        amount: 7,
        currency: WalletCurrency.Usd,
        currencyCode: WalletCurrency.Usd,
      },
    })

    const convertMoneyAmount = jest.fn(({ amount }) => ({
      amount,
      currency: "USD",
      currencyCode: "USD",
    }))

    const result = toTransactionFragment(tx, {
      displayCurrency: "USD",
      convertMoneyAmount: convertMoneyAmount as never,
      fractionDigits: 2,
    })

    expect(result.settlementFee).toBe(7)
    expect(result.settlementCurrency).toBe(WalletCurrency.Usd)
  })
})
