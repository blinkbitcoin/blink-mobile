import { getBreezClient } from "../../client"

export const getInfo = async () => {
  const sdk = await getBreezClient()
  const info = await sdk.getInfo({ ensureSynced: true })

  return {
    identityPubkey: info.identityPubkey,
    balanceSats: info.balanceSats.toString(),
    tokenBalances: info.tokenBalances,
  }
}
