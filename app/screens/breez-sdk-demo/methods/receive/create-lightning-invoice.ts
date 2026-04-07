import { ReceivePaymentMethod } from "@breeztech/breez-sdk-spark-react-native"

import { getBreezClient } from "../../client"

export const createLightningInvoice = async (amountSats: number) => {
  const sdk = await getBreezClient()

  const response = await sdk.receivePayment({
    paymentMethod: new ReceivePaymentMethod.Bolt11Invoice({
      description: "Breez SDK Demo",
      amountSats: BigInt(amountSats),
      expirySecs: 3600,
      paymentHash: undefined,
    }),
  })

  return {
    invoice: response.paymentRequest,
    fee: response.fee,
  }
}
