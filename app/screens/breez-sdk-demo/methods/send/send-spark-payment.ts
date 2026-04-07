import { getBreezClient } from "../../client"

export const sendSparkPayment = async (sparkAddress: string, amountSats: number) => {
  const sdk = await getBreezClient()

  const prepareResponse = await sdk.prepareSendPayment({
    paymentRequest: sparkAddress,
    amount: BigInt(amountSats),
    tokenIdentifier: undefined,
    conversionOptions: undefined,
    feePolicy: undefined,
  })

  const sendResponse = await sdk.sendPayment({
    prepareResponse,
    options: undefined,
    idempotencyKey: undefined,
  })

  return {
    payment: sendResponse.payment,
  }
}
