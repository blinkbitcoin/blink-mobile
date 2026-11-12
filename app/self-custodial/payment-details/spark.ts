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
  IdempotencyKeyRef,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import { resolveSendTokenIdentifier, toSdkSendAmount } from "../bridge"
import { ScRail } from "../measurement"

import {
  createGetFee,
  createSendMutation,
  requestedAsOf,
  sendAllFeePolicy,
} from "./send-helpers"

type CreateSparkParams<T extends WalletCurrency> = {
  sdk: BreezSdkInterface
  address: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  idempotencyKeyRef?: IdempotencyKeyRef
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

  /**
   * Same holder for every rebuild, as the LNURL detail keeps it: the send hook mints the
   * key into it on the first attempt and reads it back on a retry, so a bitcoin send
   * retried after a throw is refused by the SDK as a duplicate rather than paid twice.
   * What a lost attempt leaves behind is kept by destination, apart from the detail.
   */
  const idempotencyKeyRef: IdempotencyKeyRef = params.idempotencyKeyRef ?? {}
  const paramsWithKey: CreateSparkParams<T> = { ...params, idempotencyKeyRef }

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
          telemetry: {
            rail: ScRail.Spark,
            sendingWallet: sendingWalletDescriptor.currency,
          },
          idempotencyKeyRef,
          requestedAs: requestedAsOf(unitOfAccountAmount, settlementAmount),
        }),
      }
    : { canSendPayment: false, canGetFee: false }

  const setAmount: SetAmount<T> = (newAmount, newSendMax) =>
    createSelfCustodialSparkPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: undefined,
      unitOfAccountAmount: newAmount,
      sendMax: newSendMax,
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
      idempotencyKeyRef: undefined,
      sendingWalletDescriptor: desc,
      sendMax: false,
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
    idempotencyKeyRef,
    canSetAmount: true,
    setAmount,
    canSendMax: sendingWalletDescriptor.currency === WalletCurrency.Btc,
    isSendingMax,
    isFeeIncluded: isSendingMax,
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as PaymentDetail<T>
}
