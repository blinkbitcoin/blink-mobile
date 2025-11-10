import { LnUrlPayServiceResponse, Satoshis } from "lnurl-pay"

import { WalletCurrency } from "@app/graphql/generated"
import * as PaymentDetails from "@app/screens/send-bitcoin-screen/payment-details/lightning"

import {
  btcSendingWalletDescriptor,
  btcTestAmount,
  convertMoneyAmountMock,
  createGetFeeMocks,
  createSendPaymentMocks,
  testAmount,
  usdSendingWalletDescriptor,
} from "./helpers"

const mockLnUrlPayServiceResponse = (
  min: Satoshis,
  max: Satoshis,
): LnUrlPayServiceResponse => ({
  callback: "mockCallbackUrl",
  fixed: false,
  min,
  max,
  domain: "mockDomain",
  metadata: [["mockMetadata"]],
  metadataHash: "mockMetadataHash",
  identifier: "mockIdentifier",
  description: "mockDescription",
  image: "mockImageUrl",
  commentAllowed: 0,
  rawData: {
    mockKey: "mockValue",
  },
})

const defaultParamsWithoutInvoice = {
  lnurl: "testlnurl",
  lnurlParams: mockLnUrlPayServiceResponse(1 as Satoshis, 1000 as Satoshis),
  convertMoneyAmount: convertMoneyAmountMock,
  sendingWalletDescriptor: btcSendingWalletDescriptor,
  unitOfAccountAmount: testAmount,
  isMerchant: false,
}

const defaultParamsWithInvoice = {
  ...defaultParamsWithoutInvoice,
  paymentRequest: "testinvoice",
  paymentRequestAmount: btcTestAmount,
}

const defaultParamsWithEqualMinMaxAmount = {
  ...defaultParamsWithoutInvoice,
  lnurlParams: mockLnUrlPayServiceResponse(100 as Satoshis, 100 as Satoshis),
}

describe("lnurl payment details", () => {
  const { createLnurlPaymentDetails } = PaymentDetails

  it("properly sets fields if min and max amount is equal", () => {
    const paymentDetails = createLnurlPaymentDetails(defaultParamsWithEqualMinMaxAmount)
    expect(paymentDetails).toEqual(
      expect.objectContaining({
        destination: defaultParamsWithEqualMinMaxAmount.lnurl,
        settlementAmount: defaultParamsWithEqualMinMaxAmount.unitOfAccountAmount,
        unitOfAccountAmount: defaultParamsWithEqualMinMaxAmount.unitOfAccountAmount,
        sendingWalletDescriptor:
          defaultParamsWithEqualMinMaxAmount.sendingWalletDescriptor,
        settlementAmountIsEstimated:
          defaultParamsWithEqualMinMaxAmount.sendingWalletDescriptor.currency !==
          WalletCurrency.Btc,
        canGetFee: false,
        canSendPayment: false,
        canSetAmount: false,
        canSetMemo: true,
        convertMoneyAmount: defaultParamsWithoutInvoice.convertMoneyAmount,
      }),
    )
  })

  it("properly sets fields without invoice", () => {
    const paymentDetails = createLnurlPaymentDetails(defaultParamsWithoutInvoice)
    expect(paymentDetails).toEqual(
      expect.objectContaining({
        destination: defaultParamsWithoutInvoice.lnurl,
        settlementAmount: defaultParamsWithoutInvoice.unitOfAccountAmount,
        unitOfAccountAmount: defaultParamsWithoutInvoice.unitOfAccountAmount,
        sendingWalletDescriptor: defaultParamsWithoutInvoice.sendingWalletDescriptor,
        canGetFee: false,
        settlementAmountIsEstimated:
          defaultParamsWithInvoice.sendingWalletDescriptor.currency !==
          WalletCurrency.Btc,
        canSendPayment: false,
        canSetAmount: true,
        canSetMemo: true,
        convertMoneyAmount: defaultParamsWithoutInvoice.convertMoneyAmount,
      }),
    )
  })

  it("properly sets fields with invoice set", () => {
    const paymentDetails = createLnurlPaymentDetails(defaultParamsWithInvoice)
    expect(paymentDetails).toEqual(
      expect.objectContaining({
        destination: defaultParamsWithInvoice.lnurl,
        settlementAmount: defaultParamsWithInvoice.paymentRequestAmount,
        unitOfAccountAmount: defaultParamsWithInvoice.unitOfAccountAmount,
        sendingWalletDescriptor: defaultParamsWithInvoice.sendingWalletDescriptor,
        settlementAmountIsEstimated:
          defaultParamsWithInvoice.sendingWalletDescriptor.currency !==
          WalletCurrency.Btc,
        canGetFee: true,
        canSendPayment: true,
        canSetAmount: true,
        canSetMemo: true,
        convertMoneyAmount: defaultParamsWithoutInvoice.convertMoneyAmount,
      }),
    )
  })

  describe("sending from a btc wallet", () => {
    const btcSendingWalletParams = {
      ...defaultParamsWithInvoice,
      sendingWalletDescriptor: btcSendingWalletDescriptor,
    }
    const paymentDetails = createLnurlPaymentDetails(btcSendingWalletParams)

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

      expect(feeParamsMocks.lnInvoiceFeeProbe).toHaveBeenCalledWith({
        variables: {
          input: {
            paymentRequest: btcSendingWalletParams.paymentRequest,
            walletId: btcSendingWalletParams.sendingWalletDescriptor.id,
          },
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

      expect(sendPaymentMocks.lnInvoicePaymentSend).toHaveBeenCalledWith({
        variables: {
          input: {
            paymentRequest: btcSendingWalletParams.paymentRequest,
            walletId: btcSendingWalletParams.sendingWalletDescriptor.id,
          },
        },
      })
    })
  })

  describe("sending from a usd wallet", () => {
    const usdSendingWalletParams = {
      ...defaultParamsWithInvoice,
      sendingWalletDescriptor: usdSendingWalletDescriptor,
    }
    const paymentDetails = createLnurlPaymentDetails(usdSendingWalletParams)

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

      expect(feeParamsMocks.lnUsdInvoiceFeeProbe).toHaveBeenCalledWith({
        variables: {
          input: {
            paymentRequest: usdSendingWalletParams.paymentRequest,
            walletId: usdSendingWalletParams.sendingWalletDescriptor.id,
          },
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

      expect(sendPaymentMocks.lnInvoicePaymentSend).toHaveBeenCalledWith({
        variables: {
          input: {
            paymentRequest: usdSendingWalletParams.paymentRequest,
            walletId: usdSendingWalletParams.sendingWalletDescriptor.id,
          },
        },
      })
    })
  })

  it("can set amount", () => {
    const paymentDetails = createLnurlPaymentDetails(defaultParamsWithoutInvoice)
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
    const paymentDetails = createLnurlPaymentDetails(defaultParamsWithoutInvoice)
    const sendingWalletDescriptor = {
      currency: WalletCurrency.Btc,
      id: "newtestwallet",
    }
    const newPaymentDetails = paymentDetails.setSendingWalletDescriptor(
      sendingWalletDescriptor,
    )
    expect(newPaymentDetails.sendingWalletDescriptor).toEqual(sendingWalletDescriptor)
  })
})
