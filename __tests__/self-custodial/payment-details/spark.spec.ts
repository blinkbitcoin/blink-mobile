import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType as SelfCustodialPaymentType } from "@app/types/transaction.types"

import { createSelfCustodialSparkPaymentDetails } from "@app/self-custodial/payment-details/spark"

const mockCreateGetFee = jest.fn().mockReturnValue(jest.fn())
const mockCreateSendMutation = jest.fn().mockReturnValue(jest.fn())

jest.mock("@app/self-custodial/payment-details/send-helpers", () => {
  const actual = jest.requireActual("@app/self-custodial/payment-details/send-helpers")
  return {
    ...actual,
    createGetFee: (...args: unknown[]) => mockCreateGetFee(...args),
    createSendMutation: (...args: unknown[]) => mockCreateSendMutation(...args),
  }
})

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: {},
  requireSparkTokenIdentifier: () => "usdb-token-id",
  SparkToken: { Label: "USDB", Ticker: "USDB", DefaultDecimals: 6 },
}))

const createParams = (overrides = {}) => ({
  sdk: {} as never,
  address: "sp1abc",
  unitOfAccountAmount: {
    amount: 1000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  },
  convertMoneyAmount: jest.fn().mockReturnValue({
    amount: 1000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  }),
  sendingWalletDescriptor: { id: "w-btc", currency: WalletCurrency.Btc },
  ...overrides,
})

describe("createSelfCustodialSparkPaymentDetails", () => {
  beforeEach(() => {
    mockCreateGetFee.mockClear()
    mockCreateSendMutation.mockClear()
  })

  it("returns Spark payment type", () => {
    const detail = createSelfCustodialSparkPaymentDetails(createParams())

    expect(detail.paymentType).toBe(SelfCustodialPaymentType.Spark)
  })

  it("sets destination to the Spark address", () => {
    const detail = createSelfCustodialSparkPaymentDetails(createParams())

    expect(detail.destination).toBe("sp1abc")
  })

  it("exposes send + fee when amount > 0", () => {
    const detail = createSelfCustodialSparkPaymentDetails(createParams())

    expect(detail.canSendPayment).toBe(true)
    expect(detail.canGetFee).toBe(true)
  })

  it("disables send + fee when amount is 0", () => {
    const detail = createSelfCustodialSparkPaymentDetails(
      createParams({
        convertMoneyAmount: jest.fn().mockReturnValue({
          amount: 0,
          currency: WalletCurrency.Btc,
          currencyCode: WalletCurrency.Btc,
        }),
      }),
    )

    expect(detail.canSendPayment).toBe(false)
    expect(detail.canGetFee).toBe(false)
  })

  it("passes USDB tokenIdentifier when sending wallet is USD", () => {
    createSelfCustodialSparkPaymentDetails(
      createParams({
        sendingWalletDescriptor: { id: "w-usd", currency: WalletCurrency.Usd },
        convertMoneyAmount: jest.fn().mockReturnValue({
          amount: 500,
          currency: WalletCurrency.Usd,
          currencyCode: WalletCurrency.Usd,
        }),
      }),
    )

    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: "usdb-token-id" }),
    )
    expect(mockCreateGetFee).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: "usdb-token-id" }),
    )
  })

  it("passes tokenIdentifier=undefined when sending wallet is BTC", () => {
    createSelfCustodialSparkPaymentDetails(createParams())

    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: undefined }),
    )
    expect(mockCreateGetFee).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: undefined }),
    )
  })

  it("scales USD settlement cents into USDB base units", () => {
    createSelfCustodialSparkPaymentDetails(
      createParams({
        sendingWalletDescriptor: { id: "w-usd", currency: WalletCurrency.Usd },
        convertMoneyAmount: jest.fn().mockReturnValue({
          amount: 70,
          currency: WalletCurrency.Usd,
          currencyCode: WalletCurrency.Usd,
        }),
      }),
    )

    // 70 cents ($0.70) × 10^4 = 700_000 USDB base units
    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ amount: BigInt(700000) }),
    )
  })

  it("keeps BTC settlement amount in sats", () => {
    createSelfCustodialSparkPaymentDetails(
      createParams({
        convertMoneyAmount: jest.fn().mockReturnValue({
          amount: 12345,
          currency: WalletCurrency.Btc,
          currencyCode: WalletCurrency.Btc,
        }),
      }),
    )

    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ amount: BigInt(12345) }),
    )
  })

  it("setAmount returns a new detail with the updated amount", () => {
    const detail = createSelfCustodialSparkPaymentDetails(createParams())
    const newAmount = {
      amount: 2000,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    }

    if (!detail.canSetAmount || !detail.setAmount) throw new Error("setAmount missing")
    const updated = detail.setAmount(newAmount)

    expect(updated.unitOfAccountAmount).toEqual(newAmount)
  })

  it("setSendingWalletDescriptor returns a new detail with the updated descriptor", () => {
    const detail = createSelfCustodialSparkPaymentDetails(createParams())
    const newDescriptor = { id: "w-btc-2", currency: WalletCurrency.Btc }

    const updated = detail.setSendingWalletDescriptor(newDescriptor)

    expect(updated.sendingWalletDescriptor).toEqual(newDescriptor)
  })
})
