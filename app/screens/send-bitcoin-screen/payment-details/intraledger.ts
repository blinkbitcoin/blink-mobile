import { WalletCurrency } from "@app/graphql/generated"
import { MoneyAmount, WalletOrDisplayCurrency, toWalletAmount } from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

import {
  BaseCreatePaymentDetailsParams,
  ConvertMoneyAmount,
  GetFee,
  PaymentDetail,
  PaymentDetailSendPaymentGetFee,
  PaymentDetailSetMemo,
  SendPaymentMutation,
  SetAmount,
  SetSendingWalletDescriptor,
} from "./index.types"

export type CreateIntraledgerPaymentDetailsParams<T extends WalletCurrency> = {
  handle: string
  recipientWalletId: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
} & BaseCreatePaymentDetailsParams<T>

export const createIntraledgerPaymentDetails = <T extends WalletCurrency>(
  params: CreateIntraledgerPaymentDetailsParams<T>,
): PaymentDetail<T> => {
  const {
    handle,
    recipientWalletId,
    unitOfAccountAmount,
    convertMoneyAmount,
    sendingWalletDescriptor,
    senderSpecifiedMemo,
    destinationSpecifiedMemo,
  } = params

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )

  const getFee: GetFee<T> = (_) => {
    return Promise.resolve({
      amount: toWalletAmount({
        amount: 0,
        currency: sendingWalletDescriptor.currency,
      }),
    })
  }

  let sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = {
    canSendPayment: false,
    canGetFee: false,
  }
  if (
    settlementAmount.amount &&
    sendingWalletDescriptor.currency === WalletCurrency.Btc
  ) {
    const sendPaymentMutation: SendPaymentMutation = async (paymentMutations) => {
      const { data } = await paymentMutations.intraLedgerPaymentSend({
        variables: {
          input: {
            walletId: sendingWalletDescriptor.id,
            recipientWalletId,
            amount: settlementAmount.amount,
            memo,
          },
        },
      })

      return {
        status: data?.intraLedgerPaymentSend.status,
        errors: data?.intraLedgerPaymentSend.errors,
        transaction: data?.intraLedgerPaymentSend?.transaction,
      }
    }

    sendPaymentAndGetFee = {
      canSendPayment: true,
      sendPaymentMutation,
      canGetFee: true,
      getFee,
    }
  } else if (
    settlementAmount.amount &&
    sendingWalletDescriptor.currency === WalletCurrency.Usd
  ) {
    const sendPaymentMutation: SendPaymentMutation = async (paymentMutations) => {
      const { data } = await paymentMutations.intraLedgerUsdPaymentSend({
        variables: {
          input: {
            walletId: sendingWalletDescriptor.id,
            recipientWalletId,
            amount: settlementAmount.amount,
            memo,
          },
        },
      })

      return {
        status: data?.intraLedgerUsdPaymentSend.status,
        errors: data?.intraLedgerUsdPaymentSend.errors,
        transaction: data?.intraLedgerUsdPaymentSend?.transaction,
      }
    }

    sendPaymentAndGetFee = {
      canSendPayment: true,
      sendPaymentMutation,
      canGetFee: true,
      getFee,
    }
  }

  const setConvertMoneyAmount = (newConvertMoneyAmount: ConvertMoneyAmount) => {
    return createIntraledgerPaymentDetails({
      ...params,
      convertMoneyAmount: newConvertMoneyAmount,
    })
  }

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? { canSetMemo: false }
    : {
        setMemo: (newMemo) =>
          createIntraledgerPaymentDetails({
            ...params,
            senderSpecifiedMemo: newMemo,
          }),
        canSetMemo: true,
      }

  const setAmount: SetAmount<T> = (newUnitOfAccountAmount) => {
    return createIntraledgerPaymentDetails({
      ...params,
      unitOfAccountAmount: newUnitOfAccountAmount,
    })
  }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (
    newSendingWalletDescriptor,
  ) => {
    return createIntraledgerPaymentDetails({
      ...params,
      sendingWalletDescriptor: newSendingWalletDescriptor,
    })
  }

  return {
    destination: handle,
    settlementAmount,
    settlementAmountIsEstimated: false,
    unitOfAccountAmount,
    sendingWalletDescriptor,
    memo,
    paymentType: PaymentType.Intraledger,
    setSendingWalletDescriptor,
    convertMoneyAmount,
    setConvertMoneyAmount,
    setAmount,
    canSetAmount: true,
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as const
}
