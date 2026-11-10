import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { WalletCurrency } from "@app/graphql/generated"
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
import { ConvertDirection } from "@app/types/payment"

import { buildConversionType } from "../bridge"

import { createGetFee, createSendMutation } from "./send-helpers"

type CreateLightningParams<T extends WalletCurrency> = {
  sdk: BreezSdkInterface
  paymentRequest: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  hasAmount: boolean
  idempotencyKeyRef?: IdempotencyKeyRef
} & BaseCreatePaymentDetailsParams<T>

export const createSelfCustodialLightningPaymentDetails = <T extends WalletCurrency>(
  params: CreateLightningParams<T>,
): PaymentDetail<T> => {
  const {
    sdk,
    paymentRequest,
    unitOfAccountAmount,
    hasAmount,
    convertMoneyAmount,
    sendingWalletDescriptor,
    destinationSpecifiedMemo,
    senderSpecifiedMemo,
  } = params

  /**
   * Same holder for every rebuild, as the LNURL detail keeps it: the send hook mints the
   * key into it on the first attempt and reads it back on a retry, so a bitcoin send
   * retried after a throw is refused by the SDK as a duplicate rather than paid twice.
   * What a lost attempt leaves behind is kept by destination, apart from the detail.
   */
  const idempotencyKeyRef: IdempotencyKeyRef = params.idempotencyKeyRef ?? {}
  const paramsWithKey: CreateLightningParams<T> = {
    ...params,
    idempotencyKeyRef,
  }

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )
  const btcAmount = convertMoneyAmount(unitOfAccountAmount, WalletCurrency.Btc)
  const isUsdSend = sendingWalletDescriptor.currency === WalletCurrency.Usd

  const prepareParams = {
    sdk,
    paymentRequest,
    amount: hasAmount ? undefined : BigInt(btcAmount.amount),
    conversionOptions: isUsdSend
      ? {
          conversionType: buildConversionType(ConvertDirection.UsdToBtc),
          maxSlippageBps: undefined,
          completionTimeoutSecs: undefined,
        }
      : undefined,
  }

  const sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = settlementAmount.amount
    ? {
        canSendPayment: true,
        canGetFee: true,
        getFee: createGetFee(prepareParams),
        sendPaymentMutation: createSendMutation(prepareParams, idempotencyKeyRef),
      }
    : { canSendPayment: false, canGetFee: false }

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? { canSetMemo: false }
    : {
        canSetMemo: true,
        setMemo: (newMemo) =>
          createSelfCustodialLightningPaymentDetails({
            ...paramsWithKey,
            senderSpecifiedMemo: newMemo,
          }),
      }

  const setAmount: SetAmount<T> = (newAmount) =>
    createSelfCustodialLightningPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: undefined,
      unitOfAccountAmount: newAmount,
    })

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialLightningPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: undefined,
      sendingWalletDescriptor: desc,
    })

  const setConvertMoneyAmount = (fn: ConvertMoneyAmount) =>
    createSelfCustodialLightningPaymentDetails({
      ...paramsWithKey,
      convertMoneyAmount: fn,
    })

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
    setSendingWalletDescriptor,
    idempotencyKeyRef,
    ...(hasAmount
      ? { canSetAmount: false as const, destinationSpecifiedAmount: unitOfAccountAmount }
      : { canSetAmount: true as const, setAmount }),
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as PaymentDetail<T>
}
