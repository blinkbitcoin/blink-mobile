import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType as SelfCustodialPaymentType } from "@app/types/transaction.types"
import {
  ConvertMoneyAmount,
  PaymentDetail,
  PaymentDetailSendPaymentGetFee,
  PaymentDetailSetMemo,
  SetAmount,
  SetSendingWalletDescriptor,
  BaseCreatePaymentDetailsParams,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import { resolveSendTokenIdentifier, toSdkSendAmount } from "../bridge"

import { createGetFee, createSendMutation } from "./send-helpers"

type CreateSCSparkParams<T extends WalletCurrency> = {
  sdk: BreezSdkInterface
  address: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
} & BaseCreatePaymentDetailsParams<T>

export const createSelfCustodialSparkPaymentDetails = <T extends WalletCurrency>(
  params: CreateSCSparkParams<T>,
): PaymentDetail<T> => {
  const {
    sdk,
    address,
    unitOfAccountAmount,
    convertMoneyAmount,
    sendingWalletDescriptor,
    destinationSpecifiedMemo,
    senderSpecifiedMemo,
  } = params

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )

  const prepareParams = {
    sdk,
    paymentRequest: address,
    amount: settlementAmount.amount
      ? toSdkSendAmount(settlementAmount.amount, sendingWalletDescriptor.currency)
      : undefined,
    tokenIdentifier: resolveSendTokenIdentifier(sendingWalletDescriptor.currency),
  }

  const sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = settlementAmount.amount
    ? {
        canSendPayment: true,
        canGetFee: true,
        getFee: createGetFee(prepareParams, sendingWalletDescriptor.currency),
        sendPaymentMutation: createSendMutation(prepareParams),
      }
    : { canSendPayment: false, canGetFee: false }

  const setAmount: SetAmount<T> = (newAmount) =>
    createSelfCustodialSparkPaymentDetails({
      ...params,
      unitOfAccountAmount: newAmount,
    })

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? { canSetMemo: false }
    : {
        canSetMemo: true,
        setMemo: (newMemo) =>
          createSelfCustodialSparkPaymentDetails({
            ...params,
            senderSpecifiedMemo: newMemo,
          }),
      }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialSparkPaymentDetails({
      ...params,
      sendingWalletDescriptor: desc,
    })

  const setConvertMoneyAmount = (fn: ConvertMoneyAmount) =>
    createSelfCustodialSparkPaymentDetails({ ...params, convertMoneyAmount: fn })

  return {
    destination: address,
    memo,
    convertMoneyAmount,
    setConvertMoneyAmount,
    paymentType: SelfCustodialPaymentType.Spark,
    settlementAmount,
    settlementAmountIsEstimated: false,
    unitOfAccountAmount,
    sendingWalletDescriptor,
    setSendingWalletDescriptor,
    canSetAmount: true,
    setAmount,
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as PaymentDetail<T>
}
