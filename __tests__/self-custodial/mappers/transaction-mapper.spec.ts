import { WalletCurrency } from "@app/graphql/generated"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction.types"
import { AccountType } from "@app/types/wallet.types"

import {
  mapSelfCustodialTransaction,
  mapSelfCustodialTransactions,
} from "@app/self-custodial/mappers/transaction-mapper"

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

  it("fees always use BTC currency", () => {
    const result = mapSelfCustodialTransaction(
      createPayment({
        method: 2,
        details: {
          tag: "Token",
          inner: { metadata: { ticker: "USDB", decimals: 6, identifier: "test" } },
        },
      }),
    )

    expect(result.fee?.currency).toBe(WalletCurrency.Btc)
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
