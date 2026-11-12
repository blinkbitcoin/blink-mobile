import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { PaymentType as SelfCustodialPaymentType } from "@app/types/transaction"
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
import { ScRail } from "../measurement"

import { createGetFee, createSendMutation, sendAllFeePolicy } from "./send-helpers"

type CreateSparkParams<T extends WalletCurrency> = {
  sdk: BreezSdkInterface
  address: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  /** Slid to 100%: the whole balance, with the fee taken out of it. */
  sendMax?: boolean
} & BaseCreatePaymentDetailsParams<T>

export const createSelfCustodialSparkPaymentDetails = <T extends WalletCurrency>(
  params: CreateSparkParams<T>,
): PaymentDetail<T> => {
  const {
    sdk,
    address,
    unitOfAccountAmount,
    convertMoneyAmount,
    sendingWalletDescriptor,
    destinationSpecifiedMemo,
    senderSpecifiedMemo,
    sendMax,
  } = params

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )

  const feePolicy = sendAllFeePolicy(sendMax, sendingWalletDescriptor.currency)
  const isSendingMax = feePolicy !== undefined

  const prepareParams = {
    sdk,
    paymentRequest: address,
    feePolicy,
    amount: settlementAmount.amount
      ? toSdkSendAmount(settlementAmount.amount, sendingWalletDescriptor.currency)
      : undefined,
    tokenIdentifier: resolveSendTokenIdentifier(sendingWalletDescriptor.currency),
  }

  const sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = settlementAmount.amount
    ? {
        canSendPayment: true,
        canGetFee: true,
        getFee: createGetFee(prepareParams),
        sendPaymentMutation: createSendMutation(prepareParams, {
          rail: ScRail.Spark,
          sendingWallet: sendingWalletDescriptor.currency,
        }),
      }
    : { canSendPayment: false, canGetFee: false }

  const setAmount: SetAmount<T> = (newAmount, newSendMax) =>
    createSelfCustodialSparkPaymentDetails({
      ...params,
      unitOfAccountAmount: newAmount,
      sendMax: newSendMax,
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
      sendMax: false,
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
    canSendMax: sendingWalletDescriptor.currency === WalletCurrency.Btc,
    isSendingMax,
    isFeeIncluded: isSendingMax,
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as PaymentDetail<T>
}
