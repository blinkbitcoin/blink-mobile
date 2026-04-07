import { ReceivePaymentMethod } from "@breeztech/breez-sdk-spark-react-native"

import { getBreezClient } from "../../client"

export const getSparkAddress = async () => {
  const sdk = await getBreezClient()

  const response = await sdk.receivePayment({
    paymentMethod: new ReceivePaymentMethod.SparkAddress(),
  })

  return {
    sparkAddress: response.paymentRequest,
    fee: response.fee,
  }
}
