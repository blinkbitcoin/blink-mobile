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
  SendAttemptRef,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import { resolveSendTokenIdentifier, toSdkSendAmount } from "../bridge"

import { carryLostAttempts, createGetFee, createSendMutation } from "./send-helpers"

type CreateSparkParams<T extends WalletCurrency> = {
  sdk: BreezSdkInterface
  address: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  idempotencyKeyRef?: SendAttemptRef
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
  } = params

  /**
   * Same holder for every rebuild, as the LNURL detail keeps it: the send hook mints the
   * key into it on the first attempt and reads it back on a retry, so a bitcoin send
   * retried after a throw is refused by the SDK as a duplicate rather than paid twice.
   * What a lost attempt leaves behind rides on it too.
   */
  const attemptRef: SendAttemptRef = params.idempotencyKeyRef ?? {}
  const paramsWithKey: CreateSparkParams<T> = { ...params, idempotencyKeyRef: attemptRef }

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
        getFee: createGetFee(prepareParams),
        sendPaymentMutation: createSendMutation(prepareParams, attemptRef),
      }
    : { canSendPayment: false, canGetFee: false }

  const setAmount: SetAmount<T> = (newAmount) =>
    createSelfCustodialSparkPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: carryLostAttempts(attemptRef),
      unitOfAccountAmount: newAmount,
    })

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? { canSetMemo: false }
    : {
        canSetMemo: true,
        setMemo: (newMemo) =>
          createSelfCustodialSparkPaymentDetails({
            ...paramsWithKey,
            senderSpecifiedMemo: newMemo,
          }),
      }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialSparkPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: carryLostAttempts(attemptRef),
      sendingWalletDescriptor: desc,
    })

  const setConvertMoneyAmount = (fn: ConvertMoneyAmount) =>
    createSelfCustodialSparkPaymentDetails({ ...paramsWithKey, convertMoneyAmount: fn })

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
    idempotencyKeyRef: attemptRef,
    canSetAmount: true,
    setAmount,
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as PaymentDetail<T>
}
