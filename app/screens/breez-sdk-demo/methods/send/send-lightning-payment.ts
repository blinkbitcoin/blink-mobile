import { SendPaymentOptions } from "@breeztech/breez-sdk-spark-react-native"

import { getBreezClient } from "../../client"

export const sendLightningPayment = async (bolt11Invoice: string, amountSats: number) => {
  const sdk = await getBreezClient()

  const prepareResponse = await sdk.prepareSendPayment({
    paymentRequest: bolt11Invoice,
    amount: BigInt(amountSats),
    tokenIdentifier: undefined,
    conversionOptions: undefined,
    feePolicy: undefined,
  })

  const sendResponse = await sdk.sendPayment({
    prepareResponse,
    options: new SendPaymentOptions.Bolt11Invoice({
      preferSpark: false,
      completionTimeoutSecs: 10,
    }),
    idempotencyKey: undefined,
  })

  return {
    payment: sendResponse.payment,
  }
}
