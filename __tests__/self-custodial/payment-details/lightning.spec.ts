import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { createSCLightningPaymentDetails } from "@app/self-custodial/payment-details/lightning"

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
  SparkConfig: { tokenIdentifier: "usdb-token-id" },
  SparkToken: { Label: "USDB", Ticker: "USDB", DefaultDecimals: 6 },
}))

const createParams = (overrides = {}) => ({
  sdk: {} as never,
  paymentRequest: "lnbc1...",
  unitOfAccountAmount: {
    amount: 1000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  },
  hasAmount: true,
  convertMoneyAmount: jest.fn().mockReturnValue({
    amount: 1000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  }),
  sendingWalletDescriptor: { id: "w1", currency: WalletCurrency.Btc },
  ...overrides,
})

describe("createSCLightningPaymentDetails", () => {
  beforeEach(() => {
    mockCreateGetFee.mockClear()
    mockCreateSendMutation.mockClear()
  })

  it("returns Lightning payment type", () => {
    const detail = createSCLightningPaymentDetails(createParams())
    expect(detail.paymentType).toBe(PaymentType.Lightning)
  })

  it("sets destination to paymentRequest", () => {
    const detail = createSCLightningPaymentDetails(createParams())
    expect(detail.destination).toBe("lnbc1...")
  })

  it("cannot set amount when hasAmount=true", () => {
    const detail = createSCLightningPaymentDetails(createParams({ hasAmount: true }))
    expect(detail.canSetAmount).toBe(false)
  })

  it("can set amount when hasAmount=false", () => {
    const detail = createSCLightningPaymentDetails(createParams({ hasAmount: false }))
    expect(detail.canSetAmount).toBe(true)
  })

  it("has destinationSpecifiedAmount when hasAmount=true", () => {
    const detail = createSCLightningPaymentDetails(createParams({ hasAmount: true }))
    expect(detail.destinationSpecifiedAmount).toBeDefined()
  })

  it("can send and get fee when amount > 0", () => {
    const detail = createSCLightningPaymentDetails(createParams())
    expect(detail.canSendPayment).toBe(true)
    expect(detail.canGetFee).toBe(true)
  })

  it("cannot send or get fee when amount is 0", () => {
    const detail = createSCLightningPaymentDetails(
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

  it("uses destinationSpecifiedMemo over senderSpecifiedMemo", () => {
    const detail = createSCLightningPaymentDetails(
      createParams({
        destinationSpecifiedMemo: "invoice memo",
        senderSpecifiedMemo: "sender memo",
      }),
    )
    expect(detail.memo).toBe("invoice memo")
  })

  it("uses senderSpecifiedMemo when no destinationSpecifiedMemo", () => {
    const detail = createSCLightningPaymentDetails(
      createParams({ senderSpecifiedMemo: "sender memo" }),
    )
    expect(detail.memo).toBe("sender memo")
  })

  it("cannot set memo when destinationSpecifiedMemo exists", () => {
    const detail = createSCLightningPaymentDetails(
      createParams({ destinationSpecifiedMemo: "locked" }),
    )
    expect(detail.canSetMemo).toBe(false)
  })

  it("can set memo when no destinationSpecifiedMemo", () => {
    const detail = createSCLightningPaymentDetails(createParams())
    expect(detail.canSetMemo).toBe(true)
  })

  it("setMemo returns new detail with updated memo", () => {
    const detail = createSCLightningPaymentDetails(createParams())
    if (detail.canSetMemo && detail.setMemo) {
      const updated = detail.setMemo("new memo")
      expect(updated.memo).toBe("new memo")
    }
  })

  it("setAmount returns new detail", () => {
    const detail = createSCLightningPaymentDetails(createParams({ hasAmount: false }))
    if (detail.canSetAmount && detail.setAmount) {
      const newAmount = {
        amount: 2000,
        currency: WalletCurrency.Btc,
        currencyCode: WalletCurrency.Btc,
      }
      const updated = detail.setAmount(newAmount)
      expect(updated.unitOfAccountAmount).toEqual(newAmount)
    }
  })

  it("setSendingWalletDescriptor returns new detail", () => {
    const detail = createSCLightningPaymentDetails(createParams())
    const newDesc = { id: "w2", currency: WalletCurrency.Btc }
    const updated = detail.setSendingWalletDescriptor(newDesc)
    expect(updated.sendingWalletDescriptor).toEqual(newDesc)
  })

  it("setConvertMoneyAmount returns new detail", () => {
    const newConvert = jest.fn().mockReturnValue({
      amount: 500,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    })
    const detail = createSCLightningPaymentDetails(createParams())
    const updated = detail.setConvertMoneyAmount(newConvert)
    expect(updated.convertMoneyAmount).toBe(newConvert)
  })

  it("passes USDB tokenIdentifier when sending wallet is USD", () => {
    createSCLightningPaymentDetails(
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
      WalletCurrency.Usd,
    )
  })

  it("passes tokenIdentifier=undefined when sending wallet is BTC", () => {
    createSCLightningPaymentDetails(createParams())

    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: undefined }),
    )
    expect(mockCreateGetFee).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: undefined }),
      WalletCurrency.Btc,
    )
  })

  it("scales USD settlement cents into USDB base units for hasAmount=false", () => {
    createSCLightningPaymentDetails(
      createParams({
        hasAmount: false,
        sendingWalletDescriptor: { id: "w-usd", currency: WalletCurrency.Usd },
        convertMoneyAmount: jest.fn().mockReturnValue({
          amount: 70,
          currency: WalletCurrency.Usd,
          currencyCode: WalletCurrency.Usd,
        }),
      }),
    )

    // 70 cents ($0.70) × 10^4 (USDB 6-decimal scaling vs 2-decimal display) = 700_000 base units
    expect(mockCreateSendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ amount: BigInt(700000) }),
    )
  })

  it("keeps BTC settlement amount in sats for hasAmount=false", () => {
    createSCLightningPaymentDetails(
      createParams({
        hasAmount: false,
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
})
