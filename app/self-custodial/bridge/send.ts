import {
  OnchainConfirmationSpeed,
  PrepareSendPaymentRequest,
  SendPaymentMethod_Tags as MethodTag,
  SendPaymentOptions,
  SendPaymentRequest,
  type BreezSdkInterface,
  type PrepareSendPaymentResponse,
  type SendOnchainSpeedFeeQuote,
} from "@breeztech/breez-sdk-spark-react-native"

import { toNumber } from "@app/utils/helper"

const speedFeeTotal = (quote: SendOnchainSpeedFeeQuote): number =>
  toNumber(quote.userFeeSat) + toNumber(quote.l1BroadcastFeeSat)

export type OnchainFeeTiers = {
  fast: number
  medium: number
  slow: number
}

export const extractOnchainFees = (
  prepared: PrepareSendPaymentResponse,
): OnchainFeeTiers | null => {
  if (prepared.paymentMethod?.tag !== MethodTag.BitcoinAddress) return null

  const quote = prepared.paymentMethod.inner.feeQuote
  return {
    fast: speedFeeTotal(quote.speedFast),
    medium: speedFeeTotal(quote.speedMedium),
    slow: speedFeeTotal(quote.speedSlow),
  }
}

export const extractLightningFee = (
  prepared: PrepareSendPaymentResponse,
): number | null => {
  if (prepared.paymentMethod?.tag !== MethodTag.Bolt11Invoice) return null

  const inner = prepared.paymentMethod.inner
  return (
    toNumber(inner.lightningFeeSats) +
    (inner.sparkTransferFeeSats ? toNumber(inner.sparkTransferFeeSats) : 0)
  )
}

export const prepareSend = (
  sdk: BreezSdkInterface,
  paymentRequest: string,
  amount: bigint | undefined,
) =>
  sdk.prepareSendPayment(
    PrepareSendPaymentRequest.create({
      paymentRequest,
      amount,
      tokenIdentifier: undefined,
    }),
  )

export const executeSend = (
  sdk: BreezSdkInterface,
  prepareResponse: Awaited<ReturnType<typeof prepareSend>>,
  confirmationSpeed?: OnchainConfirmationSpeed,
) =>
  sdk.sendPayment(
    SendPaymentRequest.create({
      prepareResponse,
      options: confirmationSpeed
        ? new SendPaymentOptions.BitcoinAddress({ confirmationSpeed })
        : undefined,
    }),
  )
