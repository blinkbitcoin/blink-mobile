import {
  ConversionType,
  ReceivePaymentMethod,
} from "@breeztech/breez-sdk-spark-react-native"
import Config from "react-native-config"

import { getBreezClient } from "../../client"

const TOKEN_IDENTIFIER = Config.SPARK_TOKEN_IDENTIFIER ?? ""

export const convertUsdbToBtc = async (tokenAmount: number) => {
  const sdk = await getBreezClient()

  const { paymentRequest } = await sdk.receivePayment({
    paymentMethod: new ReceivePaymentMethod.SparkAddress(),
  })

  const prepareResponse = await sdk.prepareSendPayment({
    paymentRequest,
    amount: BigInt(tokenAmount),
    tokenIdentifier: undefined,
    conversionOptions: {
      conversionType: new ConversionType.ToBitcoin({
        fromTokenIdentifier: TOKEN_IDENTIFIER,
      }),
      maxSlippageBps: 50,
      completionTimeoutSecs: 60,
    },
    feePolicy: undefined,
  })

  try {
    const sendResponse = await sdk.sendPayment({
      prepareResponse,
      options: undefined,
      idempotencyKey: undefined,
    })
    return {
      status: "success",
      conversionEstimate: prepareResponse.conversionEstimate,
      payment: sendResponse.payment,
    }
  } catch (sendError) {
    const info = await sdk.getInfo({ ensureSynced: true })
    return {
      status: "completed_with_error",
      error: sendError instanceof Error ? sendError.message : String(sendError),
      conversionEstimate: prepareResponse.conversionEstimate,
      balanceSats: info.balanceSats.toString(),
      tokenBalances: info.tokenBalances,
    }
  }
}
