import { getBreezClient } from "../../client"

export const prepareLightningPayment = async (
  bolt11Invoice: string,
  amountSats: number,
) => {
  const sdk = await getBreezClient()

  const prepareResponse = await sdk.prepareSendPayment({
    paymentRequest: bolt11Invoice,
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
