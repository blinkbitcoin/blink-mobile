import { type Network } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { mismatchedNetworkLabel, networkLabelFor } from "../config"
import { logSdkEvent, SdkLogLevel } from "../logging"

export const validateStoredNetwork = async (
  accountId: string,
  network: Network,
): Promise<boolean> => {
  const storedNetwork = await KeyStoreWrapper.getMnemonicNetworkForAccount(accountId)
  const mismatch = mismatchedNetworkLabel(storedNetwork, network)
  if (!mismatch) return true

  const message = `Network mismatch: wallet=${mismatch}, config=${networkLabelFor(network)}`
  logSdkEvent(SdkLogLevel.Error, message)
  crashlytics().recordError(new Error(message))
  return false
}
