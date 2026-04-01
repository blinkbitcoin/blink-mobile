import { ReceivePaymentMethod } from "@breeztech/breez-sdk-spark-react-native"

import { getBreezClient } from "../../client"

export const getDepositAddress = async () => {
  const sdk = await getBreezClient()

  const response = await sdk.receivePayment({
    paymentMethod: new ReceivePaymentMethod.BitcoinAddress({ newAddress: undefined }),
  })

  return {
    bitcoinAddress: response.paymentRequest,
    fee: response.fee,
  }
}
