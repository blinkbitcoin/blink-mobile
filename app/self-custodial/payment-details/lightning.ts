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
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import { resolveSendTokenIdentifier, toSdkSendAmount } from "../bridge"

import { createGetFee, createSendMutation } from "./send-helpers"

type CreateSCLightningParams<T extends WalletCurrency> = {
  sdk: BreezSdkInterface
  paymentRequest: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  hasAmount: boolean
} & BaseCreatePaymentDetailsParams<T>

export const createSelfCustodialLightningPaymentDetails = <T extends WalletCurrency>(
  params: CreateSCLightningParams<T>,
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

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )

  const prepareParams = {
    sdk,
    paymentRequest,
    amount: hasAmount
      ? undefined
      : toSdkSendAmount(settlementAmount.amount, sendingWalletDescriptor.currency),
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

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? { canSetMemo: false }
    : {
        canSetMemo: true,
        setMemo: (newMemo) =>
          createSelfCustodialLightningPaymentDetails({
            ...params,
            senderSpecifiedMemo: newMemo,
          }),
      }

  const setAmount: SetAmount<T> = (newAmount) =>
    createSelfCustodialLightningPaymentDetails({
      ...params,
      unitOfAccountAmount: newAmount,
    })

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialLightningPaymentDetails({
      ...params,
      sendingWalletDescriptor: desc,
    })

  const setConvertMoneyAmount = (fn: ConvertMoneyAmount) =>
    createSelfCustodialLightningPaymentDetails({ ...params, convertMoneyAmount: fn })

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
    ...(hasAmount
      ? { canSetAmount: false as const, destinationSpecifiedAmount: unitOfAccountAmount }
      : { canSetAmount: true as const, setAmount }),
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as PaymentDetail<T>
}
