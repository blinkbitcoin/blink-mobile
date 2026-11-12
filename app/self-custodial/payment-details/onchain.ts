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
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import { ScRail } from "../measurement"

import {
  createGetFeeOnchain,
  createSendMutationOnchain,
  sendAllFeePolicy,
} from "./send-helpers"

type CreateOnchainParams<T extends WalletCurrency> = {
  sdk: BreezSdkInterface
  address: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  feeTier?: FeeTierOption
  /** Slid to 100%: the whole balance, with the fee taken out of it. */
  sendMax?: boolean
} & BaseCreatePaymentDetailsParams<T>

export const createSelfCustodialOnchainPaymentDetails = <T extends WalletCurrency>(
  params: CreateOnchainParams<T>,
): PaymentDetail<T> => {
  const {
    sdk,
    address,
    unitOfAccountAmount,
    feeTier = FeeTierOption.Medium,
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
    amount: BigInt(settlementAmount.amount),
    feePolicy,
  }

  const sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = settlementAmount.amount
    ? {
        canSendPayment: true,
        canGetFee: true,
        getFee: createGetFeeOnchain(prepareParams, feeTier),
        sendPaymentMutation: createSendMutationOnchain(prepareParams, feeTier, {
          rail: ScRail.Onchain,
          sendingWallet: sendingWalletDescriptor.currency,
        }),
      }
    : { canSendPayment: false, canGetFee: false }

  const setAmount: SetAmount<T> = (newAmount, newSendMax) =>
    createSelfCustodialOnchainPaymentDetails({
      ...params,
      unitOfAccountAmount: newAmount,
      sendMax: newSendMax,
    })

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? { canSetMemo: false }
    : {
        canSetMemo: true,
        setMemo: (newMemo) =>
          createSelfCustodialOnchainPaymentDetails({
            ...params,
            senderSpecifiedMemo: newMemo,
          }),
      }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialOnchainPaymentDetails({
      ...params,
      sendingWalletDescriptor: desc,
      sendMax: false,
    })

  const setConvertMoneyAmount = (fn: ConvertMoneyAmount) =>
    createSelfCustodialOnchainPaymentDetails({ ...params, convertMoneyAmount: fn })

  return {
    destination: address,
    memo,
    convertMoneyAmount,
    setConvertMoneyAmount,
    paymentType: PaymentType.Onchain,
    feeTier,
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
