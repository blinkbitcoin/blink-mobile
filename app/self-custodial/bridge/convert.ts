import {
  PrepareSendPaymentRequest,
  SendPaymentRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import {
  ConvertDirection,
  PaymentResultStatus,
  type ConvertAdapter,
  type PaymentAdapterResult,
} from "@app/types/payment.types"

import { SparkConfig } from "../config"

const failed = (message: string): PaymentAdapterResult => ({
  status: PaymentResultStatus.Failed,
  errors: [{ message }],
})

export const createConvert = (sdk: BreezSdkInterface): ConvertAdapter => {
  return async ({ amount, direction }) => {
    try {
      const isBtcToUsd = direction === ConvertDirection.BtcToUsd
      const tokenIdentifier = isBtcToUsd ? SparkConfig.tokenIdentifier : undefined

      const prepared = await sdk.prepareSendPayment(
        PrepareSendPaymentRequest.create({
          paymentRequest: "",
          amount: BigInt(amount.amount),
          tokenIdentifier,
        }),
      )

      await sdk.sendPayment(SendPaymentRequest.create({ prepareResponse: prepared }))

      return { status: PaymentResultStatus.Success }
    } catch (err) {
      return failed(err instanceof Error ? err.message : `Conversion failed: ${err}`)
    }
  }
}
