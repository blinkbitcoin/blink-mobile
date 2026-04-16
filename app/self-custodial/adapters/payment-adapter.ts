import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { toBtcMoneyAmount } from "@app/types/amounts"
import {
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
} from "../bridge"

const failed = (message: string): PaymentAdapterResult => ({
  status: PaymentResultStatus.Failed,
  errors: [{ message }],
})

export const createSendPayment = (sdk: BreezSdkInterface): SendPaymentAdapter => {
  return async ({ destination, amount }) => {
    try {
      const prepared = await prepareSend(
        sdk,
        destination,
        amount ? BigInt(amount.amount) : undefined,
      )
      await executeSend(sdk, prepared)

      return { status: PaymentResultStatus.Success }
    } catch (err) {
      return failed(err instanceof Error ? err.message : `Send failed: ${err}`)
    }
  }
}

export const createGetFee = (sdk: BreezSdkInterface): GetFeeAdapter => {
  return async ({ destination, amount }) => {
    try {
      const prepared = await prepareSend(
        sdk,
        destination,
        amount ? BigInt(amount.amount) : undefined,
      )

      const onchainFees = extractOnchainFees(prepared)
      if (onchainFees) {
        const feeSats = onchainFees.fast
        const amountSats = toNumber(prepared.amount)
        return {
          paymentType: FeeQuoteType.Onchain,
          feeAmount: toBtcMoneyAmount(feeSats),
          feeTier: FeeTier.Fast,
          feeMode: FeeMode.PaySeparately,
          recipientAmount: toBtcMoneyAmount(amountSats),
          totalDebited: toBtcMoneyAmount(amountSats + feeSats),
          confirmationEtaMinutes: 10,
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
      crashlytics().log(
        `[SparkSDK] Fee quote failed: ${err instanceof Error ? err.message : err}`,
      )
      return null
    }
  }
}
