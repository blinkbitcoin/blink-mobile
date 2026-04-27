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

import { WalletCurrency } from "@app/graphql/generated"
import { centsToTokenBaseUnits } from "@app/utils/amounts"
import { toNumber } from "@app/utils/helper"

import { SparkConfig, SparkToken } from "../config"

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

export type PrepareSendOptions = {
  paymentRequest: string
  amount: bigint | undefined
  tokenIdentifier?: string
}

export const prepareSend = (sdk: BreezSdkInterface, options: PrepareSendOptions) =>
  sdk.prepareSendPayment(
    PrepareSendPaymentRequest.create({
      paymentRequest: options.paymentRequest,
      amount: options.amount,
      tokenIdentifier: options.tokenIdentifier,
    }),
  )

/**
 * Convert a wallet-native amount into the unit the Spark SDK expects for send
 * operations: sats for BTC, USDB base units for USD.
 */
export const toSdkSendAmount = (
  amount: number,
  currency: WalletCurrency,
  tokenDecimals: number = SparkToken.DefaultDecimals,
): bigint =>
  currency === WalletCurrency.Usd
    ? BigInt(centsToTokenBaseUnits(amount, tokenDecimals))
    : BigInt(amount)

/**
 * Resolve the token identifier to pass on send based on the sending wallet
 * currency. Returns the configured USDB token identifier for USD wallets and
 * `undefined` (i.e. native BTC) otherwise.
 */
export const resolveSendTokenIdentifier = (
  currency: WalletCurrency,
): string | undefined =>
  currency === WalletCurrency.Usd ? SparkConfig.tokenIdentifier || undefined : undefined

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
