import {
  ReceivePaymentMethod,
  ReceivePaymentRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import type {
  PaymentError,
  ReceiveLightningAdapter,
  ReceiveOnchainAdapter,
} from "@app/types/payment"

const receiveError = (message: string) => ({
  errors: [{ message }] as PaymentError[],
})

type Bolt11ReceiveOptions = {
  description: string
  amountSats: bigint | undefined
  expirySecs: number | undefined
}

/**
 * Every BOLT11 invoice this app mints pays the wallet that minted it, so the
 * receiver an invoice can name is never set, and the SDK generates the payment
 * hash itself.
 */
export const bolt11ReceiveMethod = ({
  description,
  amountSats,
  expirySecs,
}: Bolt11ReceiveOptions) =>
  new ReceivePaymentMethod.Bolt11Invoice({
    description,
    amountSats,
    expirySecs,
    paymentHash: undefined,
    receiverIdentityPublicKey: undefined,
  })

export const createReceiveLightning = (
  sdk: BreezSdkInterface,
): ReceiveLightningAdapter => {
  return async ({ amount, memo, expirySecs }) => {
    try {
      const response = await sdk.receivePayment(
        ReceivePaymentRequest.create({
          paymentMethod: bolt11ReceiveMethod({
            description: memo ?? "",
            amountSats: amount ? BigInt(amount.amount) : undefined,
            expirySecs,
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
  return async (params) => {
    try {
      const response = await sdk.receivePayment(
        ReceivePaymentRequest.create({
          paymentMethod: new ReceivePaymentMethod.BitcoinAddress({
            newAddress: params?.newAddress,
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
