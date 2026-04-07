import { getBreezClient } from "../../client"

export const claimDeposit = async (txid: string, vout: number) => {
  const sdk = await getBreezClient()

  return sdk.claimDeposit({
    txid,
    vout,
    maxFee: undefined,
  })
}
