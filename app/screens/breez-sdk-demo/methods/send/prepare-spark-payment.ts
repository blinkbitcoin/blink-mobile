import { getBreezClient } from "../../client"

export const prepareSparkPayment = async (sparkAddress: string, amountSats: number) => {
  const sdk = await getBreezClient()

  const prepareResponse = await sdk.prepareSendPayment({
    paymentRequest: sparkAddress,
    amount: BigInt(amountSats),
    tokenIdentifier: undefined,
    conversionOptions: undefined,
    feePolicy: undefined,
  })

  return {
    paymentMethod: prepareResponse.paymentMethod,
    conversionEstimate: prepareResponse.conversionEstimate,
  }
}
