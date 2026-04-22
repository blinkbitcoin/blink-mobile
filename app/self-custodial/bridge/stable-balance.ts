import {
  StableBalanceActiveLabel,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

export const activateStableBalance = (
  sdk: BreezSdkInterface,
  label: string,
): Promise<void> =>
  sdk.updateUserSettings({
    sparkPrivateModeEnabled: undefined,
    stableBalanceActiveLabel: new StableBalanceActiveLabel.Set({ label }),
  })

export const deactivateStableBalance = (sdk: BreezSdkInterface): Promise<void> =>
  sdk.updateUserSettings({
    sparkPrivateModeEnabled: undefined,
    stableBalanceActiveLabel: new StableBalanceActiveLabel.Unset(),
  })
