import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { createSelfCustodialOnchainPaymentDetails } from "@app/self-custodial/payment-details/onchain"

jest.mock("@app/self-custodial/payment-details/send-helpers", () => ({
  createGetFee: jest.fn().mockReturnValue(jest.fn()),
  createGetFeeOnchain: jest.fn().mockReturnValue(jest.fn()),
  createSendMutation: jest.fn().mockReturnValue(jest.fn()),
  createSendMutationOnchain: jest.fn().mockReturnValue(jest.fn()),
}))

jest.mock("@app/screens/send-bitcoin-screen/fee-tier-selector", () => ({
  FeeTierOption: { Fast: "fast", Medium: "medium", Slow: "slow" },
}))

const createParams = (overrides = {}) => ({
  sdk: {} as never,
  address: "bc1q...",
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
  sendingWalletDescriptor: { id: "w1", currency: WalletCurrency.Btc },
  ...overrides,
})

describe("createSelfCustodialOnchainPaymentDetails", () => {
  it("returns Onchain payment type", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    expect(detail.paymentType).toBe(PaymentType.Onchain)
  })

  it("sets destination to address", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    expect(detail.destination).toBe("bc1q...")
  })

  it("always allows setting amount", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    expect(detail.canSetAmount).toBe(true)
  })

  it("can send and get fee when amount > 0", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    expect(detail.canSendPayment).toBe(true)
    expect(detail.canGetFee).toBe(true)
  })

  it("cannot send or get fee when amount is 0", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(
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

  it("cannot set memo when destinationSpecifiedMemo exists", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(
      createParams({ destinationSpecifiedMemo: "locked" }),
    )
    expect(detail.canSetMemo).toBe(false)
  })

  it("can set memo when no destinationSpecifiedMemo", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    expect(detail.canSetMemo).toBe(true)
  })

  it("setMemo returns new detail with updated memo", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    if (detail.canSetMemo && detail.setMemo) {
      const updated = detail.setMemo("new memo")
      expect(updated.memo).toBe("new memo")
    }
  })

  it("setAmount returns new detail", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    const newAmount = {
      amount: 2000,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    }
    if (detail.setAmount) {
      const updated = detail.setAmount(newAmount)
      expect(updated.unitOfAccountAmount).toEqual(newAmount)
    }
  })

  it("setSendingWalletDescriptor returns new detail", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
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
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    const updated = detail.setConvertMoneyAmount(newConvert)
    expect(updated.convertMoneyAmount).toBe(newConvert)
  })
})
