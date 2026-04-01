import { getBreezClient } from "../../client"

export const listUnclaimedDeposits = async () => {
  const sdk = await getBreezClient()
  return sdk.listUnclaimedDeposits({})
}
