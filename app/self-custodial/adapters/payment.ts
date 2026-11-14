import {
  PaymentStatus,
  type BreezSdkInterface,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"
import { v5 as uuidv5 } from "uuid"

import { WalletCurrency } from "@app/graphql/generated"
import { toBtcMoneyAmount } from "@app/types/amounts"
import {
  FEE_TIER_ETA_MINUTES,
  FeeMode,
  FeeQuoteType,
  FeeTier,
  PaymentResultStatus,
  type GetFeeAdapter,
  type PaymentAdapterResult,
  type SendPaymentAdapter,
} from "@app/types/payment"
import { reportError } from "@app/utils/error-logging"
import { toNumber } from "@app/utils/helper"
import { generateSecureRandomUUID } from "@app/utils/uuid"

import {
  executeSend,
  extractLightningFee,
  extractOnchainFees,
  hasTokenLeg,
  identifyPreparedSend,
  prepareSend,
  resolveSendTokenIdentifier,
  toSdkSendAmount,
} from "../bridge"

const failed = (message: string): PaymentAdapterResult => ({
  status: PaymentResultStatus.Failed,
  errors: [{ message }],
})

/** Namespace for the keys derived from an invoice's payment hash (any fixed UUID). */
const INVOICE_KEY_NAMESPACE = "8f0c2a51-6b0e-4f63-9a1d-3c5e7b9d1f20"

/**
 * The key a bitcoin send through this adapter carries. Its callers hold no payment intent
 * to keep a key on across retries, so an invoice keys itself: every send of the same
 * invoice carries the same key and the SDK answers all but the first with the payment
 * the first one made. A send with no invoice gets a key of its own, which at least makes
 * the SDK's internal retries safe.
 *
 * So the first payment of an invoice is its only one through this adapter: once it has
 * failed, every later send of the invoice comes back as that failure, and the caller
 * needs a new invoice to try again.
 */
const adapterIdempotencyKey = (paymentHash: string | undefined): Promise<string> =>
  paymentHash
    ? Promise.resolve(uuidv5(paymentHash, INVOICE_KEY_NAMESPACE))
    : generateSecureRandomUUID()

export const createSendPayment = (sdk: BreezSdkInterface): SendPaymentAdapter => {
  return async ({ destination, amount }) => {
    try {
      const currency = amount?.currency ?? WalletCurrency.Btc
      const prepared = await prepareSend(sdk, {
        paymentRequest: destination,
        amount: amount ? toSdkSendAmount(amount.amount, currency) : undefined,
        tokenIdentifier: resolveSendTokenIdentifier(currency),
      })
      const idempotencyKey = hasTokenLeg(prepared)
        ? undefined
        : await adapterIdempotencyKey(identifyPreparedSend(prepared)?.paymentHash)
      const sent = await executeSend(sdk, prepared, { idempotencyKey })
      /** The SDK's types promise a payment, but a response without one has been seen: the
       *  send went out all the same, so it is reported as sent, never as failed. */
      const payment: Payment | undefined = sent?.payment
      if (payment?.status === PaymentStatus.Failed) {
        return failed(`Payment ${payment.id} failed`)
      }

      return { status: PaymentResultStatus.Success }
    } catch (err) {
      return failed(err instanceof Error ? err.message : `Send failed: ${err}`)
    }
  }
}

export const createGetFee = (sdk: BreezSdkInterface): GetFeeAdapter => {
  return async ({ destination, amount, feeTier }) => {
    try {
      const currency = amount?.currency ?? WalletCurrency.Btc
      const prepared = await prepareSend(sdk, {
        paymentRequest: destination,
        amount: amount ? toSdkSendAmount(amount.amount, currency) : undefined,
        tokenIdentifier: resolveSendTokenIdentifier(currency),
      })

      const onchainFees = extractOnchainFees(prepared)
      if (onchainFees) {
        const tier = feeTier ?? FeeTier.Fast
        const feeSats = onchainFees[tier]
        const amountSats = toNumber(prepared.amount)
        return {
          paymentType: FeeQuoteType.Onchain,
          feeAmount: toBtcMoneyAmount(feeSats),
          feeTier: tier,
          feeMode: FeeMode.PaySeparately,
          recipientAmount: toBtcMoneyAmount(amountSats),
          totalDebited: toBtcMoneyAmount(amountSats + feeSats),
          confirmationEtaMinutes: FEE_TIER_ETA_MINUTES[tier],
        }
      }

      const lnFee = extractLightningFee(prepared)
      if (lnFee !== null) {
        return {
          paymentType: FeeQuoteType.Lightning,
          feeAmount: toBtcMoneyAmount(lnFee),
        }
      }

      return {
        paymentType: FeeQuoteType.Lightning,
        feeAmount: toBtcMoneyAmount(0),
      }
    } catch (err) {
      reportError("[SparkSDK] Fee quote", err)
      return null
    }
  }
}
