import { getBreezClient } from "../../client"

export const getUserSettings = async () => {
  const sdk = await getBreezClient()
  return sdk.getUserSettings()
}
