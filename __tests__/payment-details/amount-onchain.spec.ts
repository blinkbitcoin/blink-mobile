import { PayoutSpeed, WalletCurrency } from "@app/graphql/generated"
import * as PaymentDetails from "@app/screens/send-bitcoin-screen/payment-details/onchain"
import { OnchainFeeQuote } from "@app/screens/send-bitcoin-screen/payment-details/index.types"

import {
  btcSendingWalletDescriptor,
  convertMoneyAmountMock,
  createGetFeeMocks,
  createSendPaymentMocks,
  expectDestinationSpecifiedMemoCannotSetMemo,
  testAmount,
  usdSendingWalletDescriptor,
} from "./helpers"

const defaultParams: PaymentDetails.CreateAmountOnchainPaymentDetailsParams<WalletCurrency> =
  {
    address: "testaddress",
    destinationSpecifiedAmount: testAmount,
    convertMoneyAmount: convertMoneyAmountMock,
    sendingWalletDescriptor: btcSendingWalletDescriptor,
  }

describe("no amount onchain payment details", () => {
  const { createAmountOnchainPaymentDetails } = PaymentDetails

  it("properly sets fields with all arguments provided", () => {
    const paymentDetails = createAmountOnchainPaymentDetails(defaultParams)
    expect(paymentDetails).toEqual(
      expect.objectContaining({
        destination: defaultParams.address,
        settlementAmount: defaultParams.convertMoneyAmount(
          defaultParams.destinationSpecifiedAmount,
          defaultParams.sendingWalletDescriptor.currency,
        ),
        unitOfAccountAmount: defaultParams.destinationSpecifiedAmount,
        sendingWalletDescriptor: defaultParams.sendingWalletDescriptor,
        settlementAmountIsEstimated: false,
        canGetFee: true,
        canSendPayment: true,
        canSetAmount: false,
        canSetMemo: true,
        convertMoneyAmount: defaultParams.convertMoneyAmount,
      }),
    )
  })

  describe("sending from a btc wallet", () => {
    const btcSendingWalletParams = {
      ...defaultParams,
      sendingWalletDescriptor: btcSendingWalletDescriptor,
    }
    const paymentDetails = createAmountOnchainPaymentDetails(btcSendingWalletParams)
    const settlementAmount = defaultParams.convertMoneyAmount(
      testAmount,
      btcSendingWalletDescriptor.currency,
    )

    it("uses the correct fee mutations and args", async () => {
      const feeParamsMocks = createGetFeeMocks()
      if (!paymentDetails.canGetFee) {
        throw new Error("Cannot get fee")
      }

      try {
        await paymentDetails.getFee(feeParamsMocks)
      } catch {
        // do nothing as function is expected to throw since we are not mocking the fee response
      }

      expect(feeParamsMocks.onChainTxFee).toHaveBeenCalledWith({
        variables: {
          address: defaultParams.address,
          amount: settlementAmount.amount,
          walletId: btcSendingWalletParams.sendingWalletDescriptor.id,
          speed: PayoutSpeed.Fast,
        },
      })
    })

    it("uses the correct send payment mutation and args", async () => {
      const sendPaymentMocks = createSendPaymentMocks()
      if (!paymentDetails.canSendPayment) {
        throw new Error("Cannot send payment")
      }

      try {
        await paymentDetails.sendPaymentMutation(sendPaymentMocks)
      } catch {
        // do nothing as function is expected to throw since we are not mocking the send payment response
      }

      expect(sendPaymentMocks.onChainPaymentSend).toHaveBeenCalledWith({
        variables: {
          input: {
            address: defaultParams.address,
            amount: settlementAmount.amount,
            walletId: btcSendingWalletParams.sendingWalletDescriptor.id,
            speed: PayoutSpeed.Fast,
          },
        },
      })
    })
  })

  describe("sending from a usd wallet", () => {
    const usdSendingWalletParams = {
      ...defaultParams,
      sendingWalletDescriptor: usdSendingWalletDescriptor,
    }
    const paymentDetails = createAmountOnchainPaymentDetails(usdSendingWalletParams)

    it("uses the correct fee mutations and args", async () => {
      const feeParamsMocks = createGetFeeMocks()
      if (!paymentDetails.canGetFee) {
        throw new Error("Cannot get fee")
      }

      try {
        await paymentDetails.getFee(feeParamsMocks)
      } catch {
        // do nothing as function is expected to throw since we are not mocking the fee response
      }

      expect(feeParamsMocks.onChainUsdTxFeeAsBtcDenominated).toHaveBeenCalledWith({
        variables: {
          address: defaultParams.address,
          amount: usdSendingWalletParams.destinationSpecifiedAmount.amount,
          walletId: usdSendingWalletParams.sendingWalletDescriptor.id,
          speed: PayoutSpeed.Fast,
        },
      })
    })

    it("uses the correct send payment mutation and args", async () => {
      const sendPaymentMocks = createSendPaymentMocks()
      if (!paymentDetails.canSendPayment) {
        throw new Error("Cannot send payment")
      }

      try {
        await paymentDetails.sendPaymentMutation(sendPaymentMocks)
      } catch {
        // do nothing as function is expected to throw since we are not mocking the send payment response
      }

      expect(sendPaymentMocks.onChainUsdPaymentSendAsBtcDenominated).toHaveBeenCalledWith(
        {
          variables: {
            input: {
              address: defaultParams.address,
              amount: usdSendingWalletParams.destinationSpecifiedAmount.amount,
              walletId: usdSendingWalletParams.sendingWalletDescriptor.id,
              speed: PayoutSpeed.Fast,
            },
          },
        },
      )
    })
  })

  it("cannot set memo if memo is provided", () => {
    const paramsWithMemo = {
      ...defaultParams,
      destinationSpecifiedMemo: "sender memo",
    }
    const paymentDetails = createAmountOnchainPaymentDetails(paramsWithMemo)
    expectDestinationSpecifiedMemoCannotSetMemo(
      paymentDetails,
      paramsWithMemo.destinationSpecifiedMemo,
    )
  })

  it("can set memo if no memo provided", () => {
    const paymentDetails = createAmountOnchainPaymentDetails(defaultParams)
    const senderSpecifiedMemo = "sender memo"
    if (!paymentDetails.canSetMemo) throw new Error("Memo is unable to be set")

    const newPaymentDetails = paymentDetails.setMemo(senderSpecifiedMemo)
    expect(newPaymentDetails.memo).toEqual(senderSpecifiedMemo)
  })

  it("can set sending wallet descriptor", () => {
    const paymentDetails = createAmountOnchainPaymentDetails(defaultParams)
    const sendingWalletDescriptor = {
      currency: WalletCurrency.Btc,
      id: "newtestwallet",
    }
    const newPaymentDetails = paymentDetails.setSendingWalletDescriptor(
      sendingWalletDescriptor,
    )
    expect(newPaymentDetails.sendingWalletDescriptor).toEqual(sendingWalletDescriptor)
  })

  describe("payout speed", () => {
    it("defaults to the schema default so behaviour is unchanged until the user picks", () => {
      const paymentDetails = createAmountOnchainPaymentDetails(defaultParams)
      expect(paymentDetails.payoutSpeed).toEqual(PayoutSpeed.Fast)
    })

    it("carries the selected speed onto the rebuilt payment detail", () => {
      const paymentDetails = createAmountOnchainPaymentDetails(defaultParams)
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      const slowDetails = paymentDetails.setPayoutSpeed(PayoutSpeed.Slow)
      expect(slowDetails.payoutSpeed).toEqual(PayoutSpeed.Slow)
    })

    it("quotes the fee for the selected speed and maps it to the wallet currency", async () => {
      const feeParamsMocks = createGetFeeMocks()
      ;(feeParamsMocks.onChainTxFee as jest.Mock).mockResolvedValue({
        data: { onChainTxFee: { amount: 450 } },
      })
      const paymentDetails = createAmountOnchainPaymentDetails(defaultParams)
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      const slowDetails = paymentDetails.setPayoutSpeed(PayoutSpeed.Slow)
      if (!slowDetails.canGetFee) throw new Error("Cannot get fee")

      const fee = await slowDetails.getFee(feeParamsMocks)

      expect(feeParamsMocks.onChainTxFee).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({ speed: PayoutSpeed.Slow }),
        }),
      )
      expect(fee.amount).toEqual(
        expect.objectContaining({ amount: 450, currency: WalletCurrency.Btc }),
      )
    })

    it("sends the payment with the selected speed", async () => {
      const sendPaymentMocks = createSendPaymentMocks()
      ;(sendPaymentMocks.onChainPaymentSend as jest.Mock).mockResolvedValue({
        data: {
          onChainPaymentSend: {
            status: "SUCCESS",
            errors: [],
            transaction: {
              settlementVia: {
                __typename: "SettlementViaOnChain",
                arrivalInMempoolEstimatedAt: 1234,
              },
            },
          },
        },
      })
      const paymentDetails = createAmountOnchainPaymentDetails(defaultParams)
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      const mediumDetails = paymentDetails.setPayoutSpeed(PayoutSpeed.Medium)
      if (!mediumDetails.canSendPayment) throw new Error("Cannot send payment")

      try {
        await mediumDetails.sendPaymentMutation(sendPaymentMocks)
      } catch {
        // the send response is not mocked, only the call arguments matter here
      }

      expect(sendPaymentMocks.onChainPaymentSend).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            input: expect.objectContaining({ speed: PayoutSpeed.Medium }),
          }),
        }),
      )
    })

    it("quotes a usd wallet as-btc-denominated with the selected speed", async () => {
      const feeParamsMocks = createGetFeeMocks()
      ;(feeParamsMocks.onChainUsdTxFeeAsBtcDenominated as jest.Mock).mockResolvedValue({
        data: { onChainUsdTxFeeAsBtcDenominated: { amount: 12 } },
      })
      const paymentDetails = createAmountOnchainPaymentDetails({
        ...defaultParams,
        sendingWalletDescriptor: usdSendingWalletDescriptor,
      })
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      const slowDetails = paymentDetails.setPayoutSpeed(PayoutSpeed.Slow)
      if (!slowDetails.canGetFee) throw new Error("Cannot get fee")

      const fee = await slowDetails.getFee(feeParamsMocks)

      expect(feeParamsMocks.onChainUsdTxFeeAsBtcDenominated).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({ speed: PayoutSpeed.Slow }),
        }),
      )
      expect(fee.amount).toEqual(
        expect.objectContaining({ amount: 12, currency: WalletCurrency.Usd }),
      )
    })
  })

  describe("fee quote", () => {
    it("quotes a btc wallet in sats", () => {
      const paymentDetails = createAmountOnchainPaymentDetails(defaultParams)
      expect(paymentDetails.feeQuote).toBe(OnchainFeeQuote.Btc)
    })

    it("quotes a usd wallet as-btc when the destination fixed the amount", () => {
      const paymentDetails = createAmountOnchainPaymentDetails({
        ...defaultParams,
        sendingWalletDescriptor: usdSendingWalletDescriptor,
      })
      expect(paymentDetails.feeQuote).toBe(OnchainFeeQuote.UsdAsBtcDenominated)
    })

    it("keeps the quote when the payout speed changes", () => {
      const paymentDetails = createAmountOnchainPaymentDetails(defaultParams)
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      expect(paymentDetails.setPayoutSpeed(PayoutSpeed.Slow).feeQuote).toBe(
        OnchainFeeQuote.Btc,
      )
    })
  })
})
