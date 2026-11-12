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
import { FeeTierOption } from "@app/types/fee-tiers"

import { ScRail } from "../measurement"

import {
  createGetFeeOnchain,
  createSendMutationOnchain,
  requestedAsOf,
  sendAllFeePolicy,
} from "./send-helpers"

type CreateOnchainParams<T extends WalletCurrency> = {
  sdk: BreezSdkInterface
  address: string
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  feeTier?: FeeTierOption
  idempotencyKeyRef?: IdempotencyKeyRef
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

  /**
   * Same holder for every rebuild, as the LNURL detail keeps it: the send hook mints the
   * key into it on the first attempt and reads it back on a retry, so a bitcoin send
   * retried after a throw is refused by the SDK as a duplicate rather than paid twice.
   * What a lost attempt leaves behind is kept by destination, apart from the detail.
   */
  const idempotencyKeyRef: IdempotencyKeyRef = params.idempotencyKeyRef ?? {}
  const paramsWithKey: CreateOnchainParams<T> = {
    ...params,
    idempotencyKeyRef,
  }

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
          telemetry: {
            rail: ScRail.Onchain,
            sendingWallet: sendingWalletDescriptor.currency,
          },
          idempotencyKeyRef,
          requestedAs: requestedAsOf(unitOfAccountAmount, settlementAmount),
        }),
      }
    : { canSendPayment: false, canGetFee: false }

  const setAmount: SetAmount<T> = (newAmount, newSendMax) =>
    createSelfCustodialOnchainPaymentDetails({
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
          createSelfCustodialOnchainPaymentDetails({
            ...paramsWithKey,
            senderSpecifiedMemo: newMemo,
          }),
      }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialOnchainPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: undefined,
      sendingWalletDescriptor: desc,
      sendMax: false,
    })

  const setConvertMoneyAmount = (fn: ConvertMoneyAmount) =>
    createSelfCustodialOnchainPaymentDetails({ ...paramsWithKey, convertMoneyAmount: fn })

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
