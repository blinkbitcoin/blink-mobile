import { getBreezClient } from "../../client"

export const prepareOnchainPayment = async (
  bitcoinAddress: string,
  amountSats: number,
) => {
  const sdk = await getBreezClient()

  const prepareResponse = await sdk.prepareSendPayment({
    paymentRequest: bitcoinAddress,
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
