import {
  StableBalanceActiveLabel,
  UpdateUserSettingsRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

/** Built through the generated factory rather than an object literal: the factory fills in
 *  every field the SDK adds with a "no change" default, which is what kept these two calls
 *  compiling across the 0.15 to 0.22 upgrade instead of breaking on a new required key. */
export const activateStableBalance = (
  sdk: BreezSdkInterface,
  label: string,
): Promise<void> =>
  sdk.updateUserSettings(
    UpdateUserSettingsRequest.create({
      sparkPrivateModeEnabled: undefined,
      stableBalanceActiveLabel: new StableBalanceActiveLabel.Set({ label }),
    }),
  )

export const deactivateStableBalance = (sdk: BreezSdkInterface): Promise<void> =>
  sdk.updateUserSettings(
    UpdateUserSettingsRequest.create({
      sparkPrivateModeEnabled: undefined,
      stableBalanceActiveLabel: new StableBalanceActiveLabel.Unset(),
    }),
  )
