import {
  OnchainConfirmationSpeed,
  SendPaymentOptions,
} from "@breeztech/breez-sdk-spark-react-native"

import { getBreezClient } from "../../client"

export const sendOnchainPayment = async (bitcoinAddress: string, amountSats: number) => {
  const sdk = await getBreezClient()

  const prepareResponse = await sdk.prepareSendPayment({
    paymentRequest: bitcoinAddress,
    amount: BigInt(amountSats),
    tokenIdentifier: undefined,
    conversionOptions: undefined,
    feePolicy: undefined,
  })

  const sendResponse = await sdk.sendPayment({
    prepareResponse,
    options: new SendPaymentOptions.BitcoinAddress({
      confirmationSpeed: OnchainConfirmationSpeed.Medium,
    }),
    idempotencyKey: undefined,
  })

  return {
    payment: sendResponse.payment,
  }
}
