import { LnUrlPayServiceResponse, LNURLPaySuccessAction } from "lnurl-pay"

import { WalletCurrency } from "@app/graphql/generated"
import {
  BtcMoneyAmount,
  MoneyAmount,
  toBtcMoneyAmount,
  toWalletAmount,
  WalletAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

import {
  ConvertMoneyAmount,
  SetSuccessAction,
  SetInvoice,
  GetFee,
  PaymentDetail,
  SendPaymentMutation,
  SetAmount,
  SetSendingWalletDescriptor,
  BaseCreatePaymentDetailsParams,
  PaymentDetailSetMemo,
  PaymentDetailSendPaymentGetFee,
  PaymentDetailSetAmount,
} from "./index.types"

export type CreateNoAmountLightningPaymentDetailsParams<T extends WalletCurrency> = {
  paymentRequest: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
} & BaseCreatePaymentDetailsParams<T>

export const createNoAmountLightningPaymentDetails = <T extends WalletCurrency>(
  params: CreateNoAmountLightningPaymentDetailsParams<T>,
): PaymentDetail<T> => {
  const {
    paymentRequest,
    convertMoneyAmount,
    unitOfAccountAmount,
    sendingWalletDescriptor,
    destinationSpecifiedMemo,
    senderSpecifiedMemo,
  } = params

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )

  const setConvertMoneyAmount = (convertMoneyAmount: ConvertMoneyAmount) => {
    return createNoAmountLightningPaymentDetails({
      ...params,
      convertMoneyAmount,
    })
  }

  let sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = {
    canSendPayment: false,
    canGetFee: false,
  }

  if (
    settlementAmount?.amount &&
    sendingWalletDescriptor.currency === WalletCurrency.Btc
  ) {
    const getFee: GetFee<T> = async (getFeeFns) => {
      const { data } = await getFeeFns.lnNoAmountInvoiceFeeProbe({
        variables: {
          input: {
            amount: settlementAmount.amount,
            paymentRequest,
            walletId: sendingWalletDescriptor.id,
          },
        },
      })

      const rawAmount = data?.lnNoAmountInvoiceFeeProbe.amount
      const amount =
        typeof rawAmount === "number"
          ? toWalletAmount({
              amount: rawAmount,
              currency: sendingWalletDescriptor.currency,
            })
          : rawAmount

      return {
        amount,
        errors: data?.lnNoAmountInvoiceFeeProbe.errors,
      }
    }

    const sendPaymentMutation: SendPaymentMutation = async (paymentMutations) => {
      const { data } = await paymentMutations.lnNoAmountInvoicePaymentSend({
        variables: {
          input: {
            walletId: sendingWalletDescriptor.id,
            paymentRequest,
            amount: settlementAmount.amount,
            memo,
          },
        },
      })

      return {
        status: data?.lnNoAmountInvoicePaymentSend.status,
        errors: data?.lnNoAmountInvoicePaymentSend.errors,
        transaction: data?.lnNoAmountInvoicePaymentSend.transaction,
      }
    }

    sendPaymentAndGetFee = {
      canSendPayment: true,
      canGetFee: true,
      getFee,
      sendPaymentMutation,
    }
  } else if (
    settlementAmount?.amount &&
    sendingWalletDescriptor.currency === WalletCurrency.Usd
  ) {
    const getFee: GetFee<T> = async (getFeeFns) => {
      const { data } = await getFeeFns.lnNoAmountUsdInvoiceFeeProbe({
        variables: {
          input: {
            amount: settlementAmount.amount,
            paymentRequest,
            walletId: sendingWalletDescriptor.id,
          },
        },
      })

      const rawAmount = data?.lnNoAmountUsdInvoiceFeeProbe.amount
      const amount =
        typeof rawAmount === "number"
          ? toWalletAmount({
              amount: rawAmount,
              currency: sendingWalletDescriptor.currency,
            })
          : rawAmount

      return {
        amount,
        errors: data?.lnNoAmountUsdInvoiceFeeProbe.errors,
      }
    }

    const sendPaymentMutation: SendPaymentMutation = async (paymentMutations) => {
      const { data } = await paymentMutations.lnNoAmountUsdInvoicePaymentSend({
        variables: {
          input: {
            walletId: sendingWalletDescriptor.id,
            paymentRequest,
            amount: settlementAmount.amount,
            memo,
          },
        },
      })

      return {
        status: data?.lnNoAmountUsdInvoicePaymentSend.status,
        errors: data?.lnNoAmountUsdInvoicePaymentSend.errors,
        transaction: data?.lnNoAmountUsdInvoicePaymentSend.transaction,
      }
    }

    sendPaymentAndGetFee = {
      canSendPayment: true,
      canGetFee: true,
      getFee,
      sendPaymentMutation,
    }
  }

  const setAmount: SetAmount<T> = (newUnitOfAccountAmount) => {
    return createNoAmountLightningPaymentDetails({
      ...params,
      unitOfAccountAmount: newUnitOfAccountAmount,
    })
  }

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? { canSetMemo: false }
    : {
        setMemo: (newMemo) =>
          createNoAmountLightningPaymentDetails({
            ...params,
            senderSpecifiedMemo: newMemo,
          }),

        canSetMemo: true,
      }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (
    newSendingWalletDescriptor,
  ) => {
    return createNoAmountLightningPaymentDetails({
      ...params,
      sendingWalletDescriptor: newSendingWalletDescriptor,
    })
  }

  return {
    destination: paymentRequest,
    memo,
    convertMoneyAmount,
    setConvertMoneyAmount,
    paymentType: PaymentType.Lightning,
    settlementAmount,
    settlementAmountIsEstimated: false,
    unitOfAccountAmount,
    sendingWalletDescriptor,
    setAmount,
    canSetAmount: true,
    ...setMemo,
    ...sendPaymentAndGetFee,
    setSendingWalletDescriptor,
  } as const
}

export type CreateAmountLightningPaymentDetailsParams<T extends WalletCurrency> = {
  paymentRequest: string
  paymentRequestAmount: BtcMoneyAmount
} & BaseCreatePaymentDetailsParams<T>

export const createAmountLightningPaymentDetails = <T extends WalletCurrency>(
  params: CreateAmountLightningPaymentDetailsParams<T>,
): PaymentDetail<T> => {
  const {
    paymentRequest,
    paymentRequestAmount,
    convertMoneyAmount,
    sendingWalletDescriptor,
    destinationSpecifiedMemo,
    senderSpecifiedMemo,
  } = params

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    paymentRequestAmount,
    sendingWalletDescriptor.currency,
  )
  const unitOfAccountAmount = paymentRequestAmount

  const sendPaymentMutation: SendPaymentMutation = async (paymentMutations) => {
    const { data } = await paymentMutations.lnInvoicePaymentSend({
      variables: {
        input: {
          walletId: sendingWalletDescriptor.id,
          paymentRequest,
          memo,
        },
      },
    })
    const { settlementVia } = data?.lnInvoicePaymentSend.transaction || {}

    return {
      status: data?.lnInvoicePaymentSend.status,
      errors: data?.lnInvoicePaymentSend.errors,
      transaction: data?.lnInvoicePaymentSend.transaction,
      extraInfo: {
        preimage:
          settlementVia?.__typename === "SettlementViaLn" ||
          settlementVia?.__typename === "SettlementViaIntraLedger"
            ? settlementVia.preImage
            : undefined,
      },
    }
  }

  let getFee: GetFee<T>

  if (sendingWalletDescriptor.currency === WalletCurrency.Btc) {
    getFee = async (getFeeFns) => {
      const { data } = await getFeeFns.lnInvoiceFeeProbe({
        variables: {
          input: {
            paymentRequest,
            walletId: sendingWalletDescriptor.id,
          },
        },
      })

      const rawAmount = data?.lnInvoiceFeeProbe.amount
      const amount =
        typeof rawAmount === "number"
          ? toWalletAmount({
              amount: rawAmount,
              currency: sendingWalletDescriptor.currency,
            })
          : rawAmount

      return {
        amount,
        errors: data?.lnInvoiceFeeProbe.errors,
      }
    }
  } else {
    getFee = async (getFeeFns) => {
      const { data } = await getFeeFns.lnUsdInvoiceFeeProbe({
        variables: {
          input: {
            paymentRequest,
            walletId: sendingWalletDescriptor.id,
          },
        },
      })

      const rawAmount = data?.lnUsdInvoiceFeeProbe.amount
      const amount =
        typeof rawAmount === "number"
          ? toWalletAmount({
              amount: rawAmount,
              currency: sendingWalletDescriptor.currency,
            })
          : rawAmount

      return {
        amount,
        errors: data?.lnUsdInvoiceFeeProbe.errors,
      }
    }
  }

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? {
        canSetMemo: false,
      }
    : {
        setMemo: (newMemo) =>
          createAmountLightningPaymentDetails({
            ...params,
            senderSpecifiedMemo: newMemo,
          }),

        canSetMemo: true,
      }

  const setConvertMoneyAmount = (newConvertMoneyAmount: ConvertMoneyAmount) => {
    return createAmountLightningPaymentDetails({
      ...params,
      convertMoneyAmount: newConvertMoneyAmount,
    })
  }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (
    newSendingWalletDescriptor,
  ) => {
    return createAmountLightningPaymentDetails({
      ...params,
      sendingWalletDescriptor: newSendingWalletDescriptor,
    })
  }

  return {
    destination: paymentRequest,
    destinationSpecifiedAmount: paymentRequestAmount,
    convertMoneyAmount,
    memo,
    paymentType: PaymentType.Lightning,
    settlementAmount,
    settlementAmountIsEstimated: sendingWalletDescriptor.currency !== WalletCurrency.Btc,
    sendingWalletDescriptor,
    unitOfAccountAmount,
    ...setMemo,
    canSetAmount: false,
    setSendingWalletDescriptor,
    setConvertMoneyAmount,
    sendPaymentMutation,
    canSendPayment: true,
    getFee,
    canGetFee: true,
  } as const
}

export type CreateLnurlPaymentDetailsParams<T extends WalletCurrency> = {
  lnurl: string
  lnurlParams: LnUrlPayServiceResponse
  paymentRequest?: string
  paymentRequestAmount?: BtcMoneyAmount
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  successAction?: LNURLPaySuccessAction
  isMerchant: boolean
} & BaseCreatePaymentDetailsParams<T>

export const createLnurlPaymentDetails = <T extends WalletCurrency>(
  params: CreateLnurlPaymentDetailsParams<T>,
): PaymentDetail<T> => {
  const {
    lnurl,
    lnurlParams,
    paymentRequest,
    paymentRequestAmount,
    unitOfAccountAmount: unitOfAccountAmountIfDestinationAmountNotSpecified,
    convertMoneyAmount,
    sendingWalletDescriptor,
    destinationSpecifiedMemo,
    senderSpecifiedMemo,
    successAction,
    isMerchant,
  } = params

  const destinationSpecifiedAmount =
    lnurlParams.max === lnurlParams.min ? toBtcMoneyAmount(lnurlParams.max) : undefined
  const unitOfAccountAmount =
    destinationSpecifiedAmount || unitOfAccountAmountIfDestinationAmountNotSpecified

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo

  let settlementAmount: WalletAmount<T>
  let sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = {
    canGetFee: false,
    canSendPayment: false,
  }

  if (paymentRequest && paymentRequestAmount) {
    const amountLightningPaymentDetails = createAmountLightningPaymentDetails({
      paymentRequest,
      paymentRequestAmount,
      convertMoneyAmount,
      sendingWalletDescriptor,
      destinationSpecifiedMemo: memo,
      senderSpecifiedMemo: memo,
    })
    settlementAmount = amountLightningPaymentDetails.settlementAmount
    if (amountLightningPaymentDetails.canSendPayment) {
      sendPaymentAndGetFee = {
        canSendPayment: true,
        sendPaymentMutation: amountLightningPaymentDetails.sendPaymentMutation,
        canGetFee: true,
        getFee: amountLightningPaymentDetails.getFee,
      }
    }
  } else {
    settlementAmount = convertMoneyAmount(
      unitOfAccountAmount,
      sendingWalletDescriptor.currency,
    )
  }

  const setAmount: PaymentDetailSetAmount<T> = destinationSpecifiedAmount
    ? {
        canSetAmount: false,
        destinationSpecifiedAmount,
      }
    : {
        canSetAmount: true,
        setAmount: (newAmount: MoneyAmount<WalletOrDisplayCurrency>) => {
          return createLnurlPaymentDetails({
            ...params,
            paymentRequest: undefined,
            paymentRequestAmount: undefined,
            unitOfAccountAmount: newAmount,
          })
        },
      }

  const setMemo: PaymentDetailSetMemo<T> = {
    setMemo: (newMemo) =>
      createLnurlPaymentDetails({
        ...params,
        senderSpecifiedMemo: newMemo,
        destinationSpecifiedMemo: newMemo,
      }),
    canSetMemo: true,
  }

  const setConvertMoneyAmount = (newConvertMoneyAmount: ConvertMoneyAmount) => {
    return createLnurlPaymentDetails({
      ...params,
      convertMoneyAmount: newConvertMoneyAmount,
    })
  }

  const setInvoice: SetInvoice<T> = ({ paymentRequest, paymentRequestAmount }) => {
    return createLnurlPaymentDetails({
      ...params,
      paymentRequest,
      paymentRequestAmount,
    })
  }

  const setSuccessAction: SetSuccessAction<T> = (newSuccessAction) => {
    return createLnurlPaymentDetails({
      ...params,
      successAction: newSuccessAction,
    })
  }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (
    newSendingWalletDescriptor,
  ) => {
    return createLnurlPaymentDetails({
      ...params,
      sendingWalletDescriptor: newSendingWalletDescriptor,
    })
  }

  return {
    lnurlParams,
    destinationSpecifiedAmount,
    sendingWalletDescriptor,
    unitOfAccountAmount,
    paymentType: PaymentType.Lnurl,
    destination: lnurl,
    settlementAmount,
    memo,
    settlementAmountIsEstimated: sendingWalletDescriptor.currency !== WalletCurrency.Btc,
    setSendingWalletDescriptor,
    setInvoice,
    convertMoneyAmount,
    setConvertMoneyAmount,
    successAction,
    setSuccessAction,
    isMerchant,
    ...setAmount,
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as const
}
