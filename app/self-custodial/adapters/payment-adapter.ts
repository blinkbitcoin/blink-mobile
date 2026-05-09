import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

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
} from "@app/types/payment.types"
import { toNumber } from "@app/utils/helper"

import {
  executeSend,
  extractLightningFee,
  extractOnchainFees,
  prepareSend,
  resolveSendTokenIdentifier,
  toSdkSendAmount,
} from "../bridge"

const failed = (message: string): PaymentAdapterResult => ({
  status: PaymentResultStatus.Failed,
  errors: [{ message }],
})

export const createSendPayment = (sdk: BreezSdkInterface): SendPaymentAdapter => {
  return async ({ destination, amount }) => {
    try {
      const currency = amount?.currency ?? WalletCurrency.Btc
      const prepared = await prepareSend(sdk, {
        paymentRequest: destination,
        amount: amount ? toSdkSendAmount(amount.amount, currency) : undefined,
        tokenIdentifier: resolveSendTokenIdentifier(currency),
      })
      await executeSend(sdk, prepared)

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
      crashlytics().recordError(
        err instanceof Error ? err : new Error(`[SparkSDK] Fee quote failed: ${err}`),
      )
      return null
    }
  }
}
