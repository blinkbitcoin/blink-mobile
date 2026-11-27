import {
  FeePolicy,
  LnurlPayRequest,
  OnchainConfirmationSpeed,
  PaymentRequest,
  PrepareLnurlPayRequest,
  PrepareSendPaymentRequest,
  SendPaymentMethod_Tags as MethodTag,
  SendPaymentOptions,
  SendPaymentRequest,
  type BreezSdkInterface,
  type ConversionEstimate,
  type ConversionOptions,
  type LnurlPayRequestDetails,
  type LnurlPayResponse,
  type PrepareLnurlPayResponse,
  type PrepareSendPaymentResponse,
  type SendOnchainSpeedFeeQuote,
} from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { centsToTokenBaseUnits } from "@app/utils/amounts"
import { toNumber } from "@app/utils/helper"

import { requireSparkTokenIdentifier, SparkToken } from "../config"

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
  const { sparkTransferFeeSats, lightningFeeSats } = prepared.paymentMethod.inner
  if (sparkTransferFeeSats !== undefined) return toNumber(sparkTransferFeeSats)
  if (lightningFeeSats !== undefined) return toNumber(lightningFeeSats)
  return null
}

/** What a dispatched send can be found by in the wallet's history. */
export type SendIdentity = { paymentHash?: string; sparkInvoice?: string }

/**
 * What a prepared send can be found by in the wallet's history once dispatched: the
 * invoice's payment hash for Lightning, the invoice itself for a Spark invoice. A send to
 * a bare Spark or bitcoin address carries nothing no other payment shares.
 */
export const identifyPreparedSend = (
  prepared: PrepareSendPaymentResponse,
): SendIdentity | undefined => {
  const method = prepared.paymentMethod
  if (!method) return undefined
  if (method.tag === MethodTag.Bolt11Invoice) {
    return { paymentHash: method.inner.invoiceDetails.paymentHash }
  }
  if (method.tag === MethodTag.SparkInvoice) {
    return { sparkInvoice: method.inner.sparkInvoiceDetails.invoice }
  }
  return undefined
}

export type PrepareSendOptions = {
  paymentRequest: string
  amount: bigint | undefined
  tokenIdentifier?: string
  conversionOptions?: ConversionOptions
  /** `FeesIncluded` takes the fee out of `amount`: a send-all passes the balance. */
  feePolicy?: FeePolicy
}

export const prepareSend = (sdk: BreezSdkInterface, options: PrepareSendOptions) =>
  sdk.prepareSendPayment(
    PrepareSendPaymentRequest.create({
      /** Input is the parse-me variant of the 0.22 PaymentRequest enum; the CrossChain
       *  variant is deliberately unused (cross-chain sends stay disabled). */
      paymentRequest: new PaymentRequest.Input({ input: options.paymentRequest }),
      amount: options.amount,
      tokenIdentifier: options.tokenIdentifier,
      conversionOptions: options.conversionOptions,
      feePolicy: options.feePolicy,
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
  currency === WalletCurrency.Usd ? requireSparkTokenIdentifier() : undefined

/** What a prepared send or LNURL pay says about the token legs it will move. */
export type PreparedTokenLegs = {
  tokenIdentifier?: string
  conversionEstimate?: ConversionEstimate
}

/**
 * Whether a prepared send moves a token on any leg: a USDB transfer, or a conversion in
 * or out of USDB on the way. The SDK has no idempotency hook for token transfers and
 * rejects a key on such a payment as invalid input before anything is sent.
 *
 * Read from the prepared payment, never from what was asked for: with stable balance
 * active and too few sats, the SDK adds a conversion to a plain bitcoin send on its own.
 */
export const hasTokenLeg = (prepared: PreparedTokenLegs): boolean =>
  prepared.tokenIdentifier !== undefined || prepared.conversionEstimate !== undefined

export type ExecuteSendOptions = {
  confirmationSpeed?: OnchainConfirmationSpeed
  /** Makes a retry of the same send come back as the payment already made instead of a
   *  second one. Dropped on a token leg, where the SDK refuses it. */
  idempotencyKey?: string
}

export const executeSend = (
  sdk: BreezSdkInterface,
  prepareResponse: Awaited<ReturnType<typeof prepareSend>>,
  { confirmationSpeed, idempotencyKey }: ExecuteSendOptions = {},
) =>
  sdk.sendPayment(
    SendPaymentRequest.create({
      prepareResponse,
      options: buildSendOptions(prepareResponse, confirmationSpeed),
      idempotencyKey: hasTokenLeg(prepareResponse) ? undefined : idempotencyKey,
    }),
  )

const buildSendOptions = (
  prepared: PrepareSendPaymentResponse,
  confirmationSpeed: OnchainConfirmationSpeed | undefined,
): SendPaymentOptions | undefined => {
  const method = prepared.paymentMethod
  if (!method) return undefined
  if (method.tag === MethodTag.BitcoinAddress && confirmationSpeed !== undefined) {
    return new SendPaymentOptions.BitcoinAddress({ confirmationSpeed })
  }
  if (method.tag === MethodTag.Bolt11Invoice) {
    return new SendPaymentOptions.Bolt11Invoice({
      preferSpark: method.inner.sparkTransferFeeSats !== undefined,
      completionTimeoutSecs: undefined,
    })
  }
  return undefined
}

export type PrepareLnurlOptions = {
  amount: bigint
  payRequest: LnurlPayRequestDetails
  comment?: string
  tokenIdentifier?: string
  conversionOptions?: ConversionOptions
  feePolicy?: FeePolicy
}

export const prepareLnurl = (sdk: BreezSdkInterface, options: PrepareLnurlOptions) =>
  sdk.prepareLnurlPay(
    PrepareLnurlPayRequest.create({
      amount: options.amount,
      payRequest: options.payRequest,
      comment: options.comment,
      tokenIdentifier: options.tokenIdentifier,
      conversionOptions: options.conversionOptions,
      feePolicy: options.feePolicy,
    }),
  )

export const extractLnurlFee = (prepared: PrepareLnurlPayResponse): number =>
  toNumber(prepared.feeSats)

/**
 * The SDK reports the fee policy it applied, which may differ from the one asked for
 * (blink-wip#2048 SR3). A send-all that came back with the fee on top would show the
 * balance less the fee while spending the balance plus it, so its quote and its send
 * stop here, before anything goes out.
 */
export const assertFeePolicyApplied = (
  requested: FeePolicy | undefined,
  prepared: { feePolicy: FeePolicy },
) => {
  if (
    requested === FeePolicy.FeesIncluded &&
    prepared.feePolicy !== FeePolicy.FeesIncluded
  ) {
    throw new Error("The SDK did not take the fee out of the amount")
  }
}

/** The key is dropped on a token leg, as `executeSend` drops it, for the same reason. */
export const executeLnurl = (
  sdk: BreezSdkInterface,
  prepareResponse: PrepareLnurlPayResponse,
  idempotencyKey?: string,
): Promise<LnurlPayResponse> =>
  sdk.lnurlPay(
    LnurlPayRequest.create({
      prepareResponse,
      idempotencyKey: hasTokenLeg(prepareResponse) ? undefined : idempotencyKey,
    }),
  )
