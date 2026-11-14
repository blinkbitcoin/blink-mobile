import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { FeePolicy } from "@breeztech/breez-sdk-spark-react-native"

import { createSelfCustodialOnchainPaymentDetails } from "@app/self-custodial/payment-details/onchain"
import {
  createGetFeeOnchain,
  createSendMutationOnchain,
  sendAllFeePolicy,
} from "@app/self-custodial/payment-details/send-helpers"

jest.mock("@app/self-custodial/payment-details/send-helpers", () => ({
  sendAllFeePolicy: jest.requireActual("@app/self-custodial/payment-details/send-helpers")
    .sendAllFeePolicy,
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

  describe("feeTier", () => {
    it("exposes the Medium default the SDK wrapper sends on", () => {
      const detail = createSelfCustodialOnchainPaymentDetails(createParams())
      expect(detail.feeTier).toBe("medium")
    })

    it("exposes the tier it was built for, so review can show it", () => {
      const detail = createSelfCustodialOnchainPaymentDetails(
        createParams({ feeTier: "slow" }),
      )
      expect(detail.feeTier).toBe("slow")
    })

    it("keeps the tier through setAmount", () => {
      const detail = createSelfCustodialOnchainPaymentDetails(
        createParams({ feeTier: "fast" }),
      )
      const updated = detail.setAmount?.({
        amount: 2000,
        currency: WalletCurrency.Btc,
        currencyCode: WalletCurrency.Btc,
      })
      expect(updated?.feeTier).toBe("fast")
    })
  })
})

describe("sendAllFeePolicy", () => {
  it("takes the fee out of a Bitcoin send-all", () => {
    expect(sendAllFeePolicy(true, WalletCurrency.Btc)).toBe(FeePolicy.FeesIncluded)
  })

  it("leaves a plain amount's fee on top", () => {
    expect(sendAllFeePolicy(false, WalletCurrency.Btc)).toBeUndefined()
    expect(sendAllFeePolicy(undefined, WalletCurrency.Btc)).toBeUndefined()
  })

  it("leaves the Dollar wallet alone until #2048 SA5 lands", () => {
    expect(sendAllFeePolicy(true, WalletCurrency.Usd)).toBeUndefined()
  })
})

describe("createSelfCustodialOnchainPaymentDetails send-all", () => {
  const balance = {
    amount: 100_000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  }
  const lastPrepareParams = (mock: unknown) => {
    const { calls } = (mock as jest.Mock).mock
    return calls[calls.length - 1][0]
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("offers a send-all on the Bitcoin wallet", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())

    expect(detail.canSendMax).toBe(true)
    expect(detail.isSendingMax).toBe(false)
    expect(detail.isFeeIncluded).toBe(false)
  })

  it("offers none on the Dollar wallet", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(
      createParams({
        sendingWalletDescriptor: { id: "w2", currency: WalletCurrency.Usd },
      }),
    )

    expect(detail.canSendMax).toBe(false)
  })

  it("quotes and sends a send-all with the fee taken out of the balance", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    const sendAll = detail.setAmount!(balance, true)

    expect(sendAll.isSendingMax).toBe(true)
    expect(sendAll.isFeeIncluded).toBe(true)
    expect(lastPrepareParams(createGetFeeOnchain).feePolicy).toBe(FeePolicy.FeesIncluded)
    expect(lastPrepareParams(createSendMutationOnchain).feePolicy).toBe(
      FeePolicy.FeesIncluded,
    )
  })

  it("puts the fee back on top once an amount is typed", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    const typed = detail.setAmount!(balance, true).setAmount!(balance)

    expect(typed.isSendingMax).toBe(false)
    expect(lastPrepareParams(createGetFeeOnchain).feePolicy).toBeUndefined()
  })

  it("drops the send-all on a wallet switch", () => {
    const detail = createSelfCustodialOnchainPaymentDetails(createParams())
    const switched = detail.setAmount!(balance, true).setSendingWalletDescriptor({
      id: "w3",
      currency: WalletCurrency.Btc,
    })

    expect(switched.isSendingMax).toBe(false)
  })
})
