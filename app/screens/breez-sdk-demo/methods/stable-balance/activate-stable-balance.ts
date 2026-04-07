import { StableBalanceActiveLabel } from "@breeztech/breez-sdk-spark-react-native"

import { getBreezClient } from "../../client"

export const activateStableBalance = async () => {
  const sdk = await getBreezClient()

  await sdk.updateUserSettings({
    sparkPrivateModeEnabled: undefined,
    stableBalanceActiveLabel: new StableBalanceActiveLabel.Set({ label: "USDB" }),
  })

  const settings = await sdk.getUserSettings()
  const info = await sdk.getInfo({ ensureSynced: true })

  return {
    userSettings: settings,
    tokenBalances: info.tokenBalances,
  }
}
