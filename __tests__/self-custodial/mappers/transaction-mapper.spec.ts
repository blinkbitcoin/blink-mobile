import { WalletCurrency } from "@app/graphql/generated"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"
import { AccountType } from "@app/types/wallet"

import {
  mapCurrency,
  mapSelfCustodialTransaction,
  mapSelfCustodialTransactions,
} from "@app/self-custodial/mappers/transaction-mapper"

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (err: Error) => mockRecordError(err),
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => {
  const instanceOf = (tag: string) => ({
    instanceOf: (obj: { tag?: string }) => obj?.tag === tag,
  })
  return {
    PaymentMethod: {
      Lightning: 0,
      Spark: 1,
      Token: 2,
      Deposit: 3,
      Withdraw: 4,
      Unknown: 5,
    },
    PaymentStatus: { Completed: 0, Pending: 1, Failed: 2 },
    PaymentType: { Send: 0, Receive: 1 },
    // eslint-disable-next-line camelcase
    PaymentDetails_Tags: {
      Spark: "Spark",
      Token: "Token",
      Lightning: "Lightning",
      Withdraw: "Withdraw",
      Deposit: "Deposit",
    },
    PaymentDetails: {
      Lightning: instanceOf("Lightning"),
      Spark: instanceOf("Spark"),
      Token: instanceOf("Token"),
      Deposit: instanceOf("Deposit"),
      Withdraw: instanceOf("Withdraw"),
    },
  }
})

type TestPayment = Parameters<typeof mapSelfCustodialTransaction>[0]

const createPayment = (overrides: Record<string, unknown> = {}): TestPayment =>
  ({
    id: "pay-1",
    paymentType: 0,
    status: 0,
    amount: BigInt(500),
    fees: BigInt(10),
    timestamp: BigInt(1700000000),
    method: 0,
    details: { tag: "Lightning", inner: {} },
    ...overrides,
  }) as TestPayment

describe("mapSelfCustodialTransaction", () => {
  it("maps a Lightning send payment", () => {
    const result = mapSelfCustodialTransaction(createPayment())

    expect(result.id).toBe("pay-1")
    expect(result.direction).toBe(TransactionDirection.Send)
    expect(result.status).toBe(TransactionStatus.Completed)
    expect(result.paymentType).toBe(PaymentType.Lightning)
    expect(result.timestamp).toBe(1700000000)
    expect(result.amount.amount).toBe(500)
    expect(result.amount.currency).toBe(WalletCurrency.Btc)
    expect(result.fee?.amount).toBe(10)
    expect(result.sourceAccountType).toBe(AccountType.SelfCustodial)
  })

  it("maps Receive direction", () => {
    const result = mapSelfCustodialTransaction(createPayment({ paymentType: 1 }))

    expect(result.direction).toBe(TransactionDirection.Receive)
  })

  it("maps Pending status", () => {
    const result = mapSelfCustodialTransaction(createPayment({ status: 1 }))

    expect(result.status).toBe(TransactionStatus.Pending)
  })

  it("maps Failed status", () => {
    const result = mapSelfCustodialTransaction(createPayment({ status: 2 }))

    expect(result.status).toBe(TransactionStatus.Failed)
  })

  it("maps Spark method", () => {
    const result = mapSelfCustodialTransaction(createPayment({ method: 1 }))

    expect(result.paymentType).toBe(PaymentType.Spark)
  })

  it("maps Token details as conversion with USD currency", () => {
    const result = mapSelfCustodialTransaction(
      createPayment({
        method: 2,
        details: { tag: "Token", inner: { metadata: { ticker: "USDB" } } },
      }),
    )

    expect(result.paymentType).toBe(PaymentType.Conversion)
    expect(result.amount.currency).toBe(WalletCurrency.Usd)
  })

  it("uses absolute value for amounts", () => {
    const result = mapSelfCustodialTransaction(createPayment({ amount: BigInt(-1000) }))

    expect(result.amount.amount).toBe(1000)
  })

  it("handles string amounts", () => {
    const result = mapSelfCustodialTransaction(createPayment({ amount: "750" }))

    expect(result.amount.amount).toBe(750)
  })

  it("always sets sourceAccountType to self-custodial", () => {
    const result = mapSelfCustodialTransaction(createPayment())

    expect(result.sourceAccountType).toBe(AccountType.SelfCustodial)
  })

  it("scales token payment fees from base units to USD cents and tags them as USD", () => {
    const result = mapSelfCustodialTransaction(
      createPayment({
        method: 2,
        fees: BigInt(1_500_000),
        details: {
          tag: "Token",
          inner: { metadata: { ticker: "USDB", decimals: 6, identifier: "test" } },
        },
      }),
    )

    expect(result.fee?.currency).toBe(WalletCurrency.Usd)
    expect(result.fee?.amount).toBe(150)
  })

  it("keeps BTC payment fees in sats and tags them as BTC", () => {
    const result = mapSelfCustodialTransaction(
      createPayment({
        method: 0,
        fees: BigInt(42),
        details: { tag: "Lightning", inner: {} },
      }),
    )

    expect(result.fee?.currency).toBe(WalletCurrency.Btc)
    expect(result.fee?.amount).toBe(42)
  })
})

describe("mapSelfCustodialTransactions", () => {
  it("maps array of payments", () => {
    const payments = [createPayment(), createPayment({ id: "pay-2" })]
    const result = mapSelfCustodialTransactions(payments)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe("pay-1")
    expect(result[1].id).toBe("pay-2")
  })

  it("returns empty array for empty input", () => {
    const result = mapSelfCustodialTransactions([])

    expect(result).toHaveLength(0)
  })
})

describe("mapCurrency", () => {
  it("maps Token payment details to USD", () => {
    expect(mapCurrency({ tag: "Token", inner: {} } as never)).toBe(WalletCurrency.Usd)
  })

  it("maps Lightning payment details to BTC", () => {
    expect(mapCurrency({ tag: "Lightning", inner: {} } as never)).toBe(WalletCurrency.Btc)
  })

  it("defaults to BTC when details are undefined", () => {
    expect(mapCurrency(undefined)).toBe(WalletCurrency.Btc)
  })
})

describe("mapper exhaustiveness (Critical #8)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("logs and falls back to Lightning when SDK returns PaymentMethod.Unknown", () => {
    const result = mapSelfCustodialTransaction(
      createPayment({
        method: 5, // PaymentMethod.Unknown
        details: { tag: "Spark", inner: {} },
      }),
    )

    expect(result.paymentType).toBe(PaymentType.Lightning)
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("mapPaymentMethod"),
      }),
    )
  })

  it("maps PaymentMethod.Token (without Token details) to Conversion", () => {
    const result = mapSelfCustodialTransaction(
      createPayment({
        method: 2, // PaymentMethod.Token
        details: { tag: "Spark", inner: {} },
      }),
    )

    expect(result.paymentType).toBe(PaymentType.Conversion)
    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("logs and falls back to Receive when SDK returns an unhandled paymentType", () => {
    const result = mapSelfCustodialTransaction(
      createPayment({ paymentType: 99 } as never),
    )

    expect(result.direction).toBe(TransactionDirection.Receive)
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("mapDirection"),
      }),
    )
  })

  it("maps every known PaymentDetails tag to the right currency without logging", () => {
    expect(mapCurrency({ tag: "Spark", inner: {} } as never)).toBe(WalletCurrency.Btc)
    expect(mapCurrency({ tag: "Lightning", inner: {} } as never)).toBe(WalletCurrency.Btc)
    expect(mapCurrency({ tag: "Withdraw", inner: {} } as never)).toBe(WalletCurrency.Btc)
    expect(mapCurrency({ tag: "Deposit", inner: {} } as never)).toBe(WalletCurrency.Btc)
    expect(mapCurrency({ tag: "Token", inner: {} } as never)).toBe(WalletCurrency.Usd)
    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("logs and falls back to BTC for an unknown PaymentDetails tag", () => {
    const result = mapCurrency({ tag: "FutureTag", inner: {} } as never)

    expect(result).toBe(WalletCurrency.Btc)
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("mapCurrency"),
      }),
    )
  })
})

describe("edge cases", () => {
  it("handles zero-amount payment", () => {
    const payment = createPayment({ amount: BigInt(0) })
    const result = mapSelfCustodialTransaction(payment)

    expect(result.amount.amount).toBe(0)
  })

  it("handles zero-fee payment", () => {
    const payment = createPayment({ fees: BigInt(0) })
    const result = mapSelfCustodialTransaction(payment)

    expect(result.fee?.amount).toBe(0)
  })

  it("handles Deposit method as Onchain", () => {
    const payment = createPayment({
      method: 3,
      details: { tag: "Deposit", inner: {} },
    })
    const result = mapSelfCustodialTransaction(payment)

    expect(result.paymentType).toBe(PaymentType.Onchain)
  })

  it("handles Withdraw method as Onchain", () => {
    const payment = createPayment({
      method: 4,
      details: { tag: "Withdraw", inner: {} },
    })
    const result = mapSelfCustodialTransaction(payment)

    expect(result.paymentType).toBe(PaymentType.Onchain)
  })
})
