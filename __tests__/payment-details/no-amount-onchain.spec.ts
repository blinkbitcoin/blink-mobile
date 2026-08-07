import { PayoutSpeed, WalletCurrency } from "@app/graphql/generated"
import * as PaymentDetails from "@app/screens/send-bitcoin-screen/payment-details/onchain"
import {
  type ConvertMoneyAmount,
  OnchainFeeQuote,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"

import {
  testAmount,
  btcSendingWalletDescriptor,
  convertMoneyAmountMock,
  createGetFeeMocks,
  createSendPaymentMocks,
  expectCannotGetFee,
  expectCannotSendPayment,
  expectDestinationSpecifiedMemoCannotSetMemo,
  usdSendingWalletDescriptor,
  zeroAmount,
} from "./helpers"

const defaultParams: PaymentDetails.CreateNoAmountOnchainPaymentDetailsParams<WalletCurrency> =
  {
    address: "testaddress",
    convertMoneyAmount: convertMoneyAmountMock,
    sendingWalletDescriptor: btcSendingWalletDescriptor,
    unitOfAccountAmount: testAmount,
    isSendingMax: false,
  }

describe("no amount lightning payment details", () => {
  const { createNoAmountOnchainPaymentDetails } = PaymentDetails

  it("properly sets fields with all arguments provided", () => {
    const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
    expect(paymentDetails).toEqual(
      expect.objectContaining({
        destination: defaultParams.address,
        settlementAmount: defaultParams.convertMoneyAmount(
          defaultParams.unitOfAccountAmount,
          defaultParams.sendingWalletDescriptor.currency,
        ),
        unitOfAccountAmount: defaultParams.unitOfAccountAmount,
        sendingWalletDescriptor: defaultParams.sendingWalletDescriptor,
        settlementAmountIsEstimated: false,
        canGetFee: true,
        canSendPayment: true,
        canSetAmount: true,
        canSetMemo: true,
        convertMoneyAmount: defaultParams.convertMoneyAmount,
      }),
    )
  })

  describe("sending from a btc wallet", () => {
    const btcSendingWalletParams = {
      ...defaultParams,
      unitOfAccountAmount: testAmount,
      sendingWalletDescriptor: btcSendingWalletDescriptor,
    }
    const paymentDetails = createNoAmountOnchainPaymentDetails(btcSendingWalletParams)
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
      unitOfAccountAmount: testAmount,
      sendingWalletDescriptor: usdSendingWalletDescriptor,
    }
    const paymentDetails = createNoAmountOnchainPaymentDetails(usdSendingWalletParams)
    const settlementAmount = defaultParams.convertMoneyAmount(
      testAmount,
      usdSendingWalletDescriptor.currency,
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

      expect(feeParamsMocks.onChainUsdTxFee).toHaveBeenCalledWith({
        variables: {
          address: defaultParams.address,
          amount: settlementAmount.amount,
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

      expect(sendPaymentMocks.onChainUsdPaymentSend).toHaveBeenCalledWith({
        variables: {
          input: {
            address: defaultParams.address,
            amount: settlementAmount.amount,
            walletId: usdSendingWalletParams.sendingWalletDescriptor.id,
            speed: PayoutSpeed.Fast,
          },
        },
      })
    })

    it("returns status, errors and transaction when the send resolves", async () => {
      const sendPaymentMocks = createSendPaymentMocks()
      ;(sendPaymentMocks.onChainUsdPaymentSend as jest.Mock).mockResolvedValue({
        data: {
          onChainUsdPaymentSend: {
            status: "SUCCESS",
            errors: [],
            transaction: { id: "tx-1" },
          },
        },
      })
      if (!paymentDetails.canSendPayment) throw new Error("Cannot send payment")

      const result = await paymentDetails.sendPaymentMutation(sendPaymentMocks)

      expect(result).toEqual({
        status: "SUCCESS",
        errors: [],
        transaction: { id: "tx-1" },
      })
    })

    it("maps the quoted fee to cents", async () => {
      const feeParamsMocks = createGetFeeMocks()
      ;(feeParamsMocks.onChainUsdTxFee as jest.Mock).mockResolvedValue({
        data: { onChainUsdTxFee: { amount: 12 } },
      })
      if (!paymentDetails.canGetFee) throw new Error("Cannot get fee")

      const fee = await paymentDetails.getFee(feeParamsMocks)

      expect(fee.amount).toEqual(
        expect.objectContaining({ amount: 12, currency: WalletCurrency.Usd }),
      )
    })
  })

  it("cannot calculate fee or send payment with zero amount", () => {
    const params: PaymentDetails.CreateNoAmountOnchainPaymentDetailsParams<WalletCurrency> =
      {
        ...defaultParams,
        unitOfAccountAmount: zeroAmount,
      }
    const paymentDetails = createNoAmountOnchainPaymentDetails(params)
    expectCannotGetFee(paymentDetails)
    expectCannotSendPayment(paymentDetails)
  })

  it("cannot set memo if memo is provided", () => {
    const paramsWithMemo = {
      ...defaultParams,
      destinationSpecifiedMemo: "sender memo",
    }
    const paymentDetails = createNoAmountOnchainPaymentDetails(paramsWithMemo)
    expectDestinationSpecifiedMemoCannotSetMemo(
      paymentDetails,
      paramsWithMemo.destinationSpecifiedMemo,
    )
  })

  it("can set memo if no memo provided", () => {
    const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
    const senderSpecifiedMemo = "sender memo"
    if (!paymentDetails.canSetMemo) throw new Error("Memo is unable to be set")

    const newPaymentDetails = paymentDetails.setMemo(senderSpecifiedMemo)
    expect(newPaymentDetails.memo).toEqual(senderSpecifiedMemo)
  })

  it("can set amount", () => {
    const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
    const unitOfAccountAmount = {
      amount: 100,
      currency: WalletCurrency.Btc,
      currencyCode: "BTC",
    }
    if (!paymentDetails.canSetAmount) throw new Error("Amount is unable to be set")
    const newPaymentDetails = paymentDetails.setAmount(unitOfAccountAmount)

    expect(newPaymentDetails.unitOfAccountAmount).toEqual(unitOfAccountAmount)
  })

  it("can set sending wallet descriptor", () => {
    const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
    const sendingWalletDescriptor = {
      currency: WalletCurrency.Btc,
      id: "newtestwallet",
    }
    const newPaymentDetails = paymentDetails.setSendingWalletDescriptor(
      sendingWalletDescriptor,
    )
    expect(newPaymentDetails.sendingWalletDescriptor).toEqual(sendingWalletDescriptor)
  })

  it("can set convertMoneyAmount", () => {
    const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
    const newConvertMoneyAmount: ConvertMoneyAmount = (amount, currency) => ({
      amount: amount.amount * 2,
      currency,
      currencyCode: currency,
    })

    const newPaymentDetails = paymentDetails.setConvertMoneyAmount(newConvertMoneyAmount)

    expect(newPaymentDetails.convertMoneyAmount).toBe(newConvertMoneyAmount)
    expect(newPaymentDetails.settlementAmount.amount).toEqual(testAmount.amount * 2)
  })

  describe("payout speed", () => {
    it("defaults to the schema default so behaviour is unchanged until the user picks", () => {
      const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
      expect(paymentDetails.payoutSpeed).toEqual(PayoutSpeed.Fast)
    })

    it("carries the selected speed onto the rebuilt payment detail", () => {
      const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      const slowDetails = paymentDetails.setPayoutSpeed(PayoutSpeed.Slow)
      expect(slowDetails.payoutSpeed).toEqual(PayoutSpeed.Slow)
    })

    it("quotes the fee for the selected speed and maps it to the wallet currency", async () => {
      const feeParamsMocks = createGetFeeMocks()
      ;(feeParamsMocks.onChainTxFee as jest.Mock).mockResolvedValue({
        data: { onChainTxFee: { amount: 450 } },
      })
      const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
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
      const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
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

    it("keeps the selected speed when the amount changes", () => {
      const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      const slowDetails = paymentDetails.setPayoutSpeed(PayoutSpeed.Slow)
      if (!slowDetails.canSetAmount) throw new Error("Amount is unable to be set")

      const withNewAmount = slowDetails.setAmount({
        amount: 5000,
        currency: WalletCurrency.Btc,
        currencyCode: "BTC",
      })
      expect(withNewAmount.payoutSpeed).toEqual(PayoutSpeed.Slow)
    })

    it("quotes a max send from a btc wallet with the selected speed", async () => {
      const feeParamsMocks = createGetFeeMocks()
      ;(feeParamsMocks.onChainTxFee as jest.Mock).mockResolvedValue({
        data: { onChainTxFee: { amount: 450 } },
      })
      const paymentDetails = createNoAmountOnchainPaymentDetails({
        ...defaultParams,
        isSendingMax: true,
      })
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

    it("quotes a max send from a usd wallet with the selected speed", async () => {
      const feeParamsMocks = createGetFeeMocks()
      ;(feeParamsMocks.onChainUsdTxFee as jest.Mock).mockResolvedValue({
        data: { onChainUsdTxFee: { amount: 12 } },
      })
      const paymentDetails = createNoAmountOnchainPaymentDetails({
        ...defaultParams,
        isSendingMax: true,
        sendingWalletDescriptor: usdSendingWalletDescriptor,
      })
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      const slowDetails = paymentDetails.setPayoutSpeed(PayoutSpeed.Slow)
      if (!slowDetails.canGetFee) throw new Error("Cannot get fee")

      const fee = await slowDetails.getFee(feeParamsMocks)

      expect(feeParamsMocks.onChainUsdTxFee).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({ speed: PayoutSpeed.Slow }),
        }),
      )
      expect(feeParamsMocks.onChainTxFee).not.toHaveBeenCalled()
      expect(fee.amount).toEqual(
        expect.objectContaining({ amount: 12, currency: WalletCurrency.Usd }),
      )
    })

    it("sends max with the selected speed", async () => {
      const sendPaymentMocks = createSendPaymentMocks()
      ;(sendPaymentMocks.onChainPaymentSendAll as jest.Mock).mockResolvedValue({
        data: {
          onChainPaymentSendAll: { status: "SUCCESS", errors: [], transaction: {} },
        },
      })
      const paymentDetails = createNoAmountOnchainPaymentDetails({
        ...defaultParams,
        isSendingMax: true,
      })
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      const slowDetails = paymentDetails.setPayoutSpeed(PayoutSpeed.Slow)
      if (!slowDetails.canSendPayment) throw new Error("Cannot send payment")

      try {
        await slowDetails.sendPaymentMutation(sendPaymentMocks)
      } catch {
        // the send response is not mocked, only the call arguments matter here
      }

      expect(sendPaymentMocks.onChainPaymentSendAll).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            input: expect.objectContaining({ speed: PayoutSpeed.Slow }),
          }),
        }),
      )
    })
  })

  describe("when the fee query resolves without data", () => {
    const expectUndefinedFee = async (
      params: PaymentDetails.CreateNoAmountOnchainPaymentDetailsParams<WalletCurrency>,
      feeFn: keyof ReturnType<typeof createGetFeeMocks>,
    ) => {
      const feeParamsMocks = createGetFeeMocks()
      ;(feeParamsMocks[feeFn] as jest.Mock).mockResolvedValue({ data: undefined })
      const paymentDetails = createNoAmountOnchainPaymentDetails(params)
      if (!paymentDetails.canGetFee) throw new Error("Cannot get fee")

      // A GraphQL error leaves data unset, so the amount passes through unconverted.
      expect((await paymentDetails.getFee(feeParamsMocks)).amount).toBeUndefined()
    }

    it("passes through an absent btc fee", async () => {
      await expectUndefinedFee(defaultParams, "onChainTxFee")
    })

    it("passes through an absent usd fee", async () => {
      await expectUndefinedFee(
        { ...defaultParams, sendingWalletDescriptor: usdSendingWalletDescriptor },
        "onChainUsdTxFee",
      )
    })

    it("passes through an absent btc fee when sending max", async () => {
      await expectUndefinedFee({ ...defaultParams, isSendingMax: true }, "onChainTxFee")
    })

    it("passes through an absent usd fee when sending max", async () => {
      await expectUndefinedFee(
        {
          ...defaultParams,
          isSendingMax: true,
          sendingWalletDescriptor: usdSendingWalletDescriptor,
        },
        "onChainUsdTxFee",
      )
    })
  })

  describe("fee quote", () => {
    it("quotes a btc wallet in sats", () => {
      const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
      expect(paymentDetails.feeQuote).toBe(OnchainFeeQuote.Btc)
    })

    it("quotes a usd wallet in cents", () => {
      const paymentDetails = createNoAmountOnchainPaymentDetails({
        ...defaultParams,
        sendingWalletDescriptor: usdSendingWalletDescriptor,
      })
      expect(paymentDetails.feeQuote).toBe(OnchainFeeQuote.Usd)
    })

    it("keeps the quote when the payout speed changes", () => {
      const paymentDetails = createNoAmountOnchainPaymentDetails(defaultParams)
      if (!paymentDetails.setPayoutSpeed) throw new Error("Payout speed cannot be set")

      expect(paymentDetails.setPayoutSpeed(PayoutSpeed.Slow).feeQuote).toBe(
        OnchainFeeQuote.Btc,
      )
    })
  })
})
