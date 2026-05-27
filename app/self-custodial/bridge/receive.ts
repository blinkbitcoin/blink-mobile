import crashlytics from "@react-native-firebase/crashlytics"
import {
  ReceivePaymentMethod,
  ReceivePaymentRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"

type PrepareReceiveBolt11Options = {
  amountSats?: number
  memo?: string
}

export const prepareReceiveBolt11 = async (
  sdk: BreezSdkInterface,
  { amountSats, memo }: PrepareReceiveBolt11Options,
): Promise<{ paymentRequest: string }> => {
  const response = await sdk.receivePayment(
    ReceivePaymentRequest.create({
      paymentMethod: new ReceivePaymentMethod.Bolt11Invoice({
        description: memo ?? "",
        amountSats: amountSats === undefined ? undefined : BigInt(amountSats),
        expirySecs: undefined,
        paymentHash: undefined,
      }),
    }),
  )
  return { paymentRequest: response.paymentRequest }
}

/** Spark exposes the on-chain destination through the `paymentRequest` field. */
export const prepareReceiveOnchain = async (
  sdk: BreezSdkInterface,
): Promise<{ address: string }> => {
  const response = await sdk.receivePayment(
    ReceivePaymentRequest.create({
      paymentMethod: new ReceivePaymentMethod.BitcoinAddress({
        newAddress: undefined,
      }),
    }),
  )
  return { address: response.paymentRequest }
}

type ReceiveErrorContext = {
  amountSats?: number
  currency?: string
}

export const recordReceiveError = (
  err: unknown,
  where: string,
  context: ReceiveErrorContext = {},
): void => {
  const amountTag = context.amountSats ?? "none"
  const currencyTag = context.currency ?? "none"
  crashlytics().log(
    `[Receive] ${where} failed (amount=${amountTag}, currency=${currencyTag})`,
  )
  reportError(where, err)
}
