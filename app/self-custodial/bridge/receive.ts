import {
  ReceivePaymentMethod,
  ReceivePaymentRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import type {
  PaymentError,
  ReceiveLightningAdapter,
  ReceiveOnchainAdapter,
} from "@app/types/payment.types"

const receiveError = (message: string) => ({
  errors: [{ message }] as PaymentError[],
})

export const createReceiveLightning = (
  sdk: BreezSdkInterface,
): ReceiveLightningAdapter => {
  return async ({ amount, memo }) => {
    try {
      const response = await sdk.receivePayment(
        ReceivePaymentRequest.create({
          paymentMethod: new ReceivePaymentMethod.Bolt11Invoice({
            description: memo ?? "",
            amountSats: amount ? BigInt(amount.amount) : undefined,
            expirySecs: undefined,
            paymentHash: undefined,
          }),
        }),
      )
      return { invoice: response.paymentRequest }
    } catch (err) {
      return receiveError(err instanceof Error ? err.message : `Receive failed: ${err}`)
    }
  }
}

export const createReceiveOnchain = (sdk: BreezSdkInterface): ReceiveOnchainAdapter => {
  return async () => {
    try {
      const response = await sdk.receivePayment(
        ReceivePaymentRequest.create({
          paymentMethod: new ReceivePaymentMethod.BitcoinAddress({
            newAddress: undefined,
          }),
        }),
      )
      return { address: response.paymentRequest }
    } catch (err) {
      return receiveError(
        err instanceof Error ? err.message : `Address generation failed: ${err}`,
      )
    }
  }
}
