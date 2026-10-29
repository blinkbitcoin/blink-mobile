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
        rail: ScRail.Bolt11,
        has_amount: Boolean(amount),
      })
      return { invoice: response.paymentRequest }
    } catch (err) {
      return receiveError(err instanceof Error ? err.message : `Receive failed: ${err}`)
    }
  }
}

/**
 * `signal` cancels the SDK call: aborted, it settles at once as an error-only result
 * instead of running on, so a caller that gave up can wait for it to end.
 */
export const createReceiveOnchain = (
  sdk: BreezSdkInterface,
  options?: { signal?: AbortSignal },
): ReceiveOnchainAdapter => {
  return async (params) => {
    try {
      const response = await sdk.receivePayment(
        ReceivePaymentRequest.create({
          paymentMethod: new ReceivePaymentMethod.BitcoinAddress({
            newAddress: params?.newAddress,
          }),
        }),
        options?.signal ? { signal: options.signal } : undefined,
      )
      /** Not counted here: the receive screen asks for the address on every visit and
       *  gets the same one back until it rotates, so the screen counts a request only
       *  when an address is newly handed out. */
      return { address: response.paymentRequest }
    } catch (err) {
      return receiveError(
        err instanceof Error ? err.message : `Address generation failed: ${err}`,
      )
    }
  }
}
