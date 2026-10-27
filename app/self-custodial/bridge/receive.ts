/* eslint-disable camelcase */
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

import { measure, ScEvent, ScRail } from "../measurement"

const receiveError = (message: string) => ({
  errors: [{ message }] as PaymentError[],
})

export const createReceiveLightning = (
  sdk: BreezSdkInterface,
): ReceiveLightningAdapter => {
  return async ({ amount, memo, expirySecs }) => {
    try {
      const response = await sdk.receivePayment(
        ReceivePaymentRequest.create({
          paymentMethod: new ReceivePaymentMethod.Bolt11Invoice({
            description: memo ?? "",
            amountSats: amount ? BigInt(amount.amount) : undefined,
            expirySecs,
            paymentHash: undefined,
          }),
        }),
      )
      measure(ScEvent.PaymentRequestCreated, {
        rail: ScRail.Lightning,
        has_amount: Boolean(amount),
      })
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
      measure(ScEvent.PaymentRequestCreated, { rail: ScRail.Onchain, has_amount: false })
      return { address: response.paymentRequest }
    } catch (err) {
      return receiveError(
        err instanceof Error ? err.message : `Address generation failed: ${err}`,
      )
    }
  }
}
