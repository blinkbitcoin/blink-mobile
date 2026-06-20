import { type Network } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { networkLabelFor } from "../config"
import { logSdkEvent, SdkLogLevel } from "../logging"

export const validateStoredNetwork = async (
  accountId: string,
  network: Network,
): Promise<boolean> => {
  const storedNetwork = await KeyStoreWrapper.getMnemonicNetworkForAccount(accountId)
  if (!storedNetwork) return true

  const label = networkLabelFor(network)
  if (storedNetwork === label) return true

  const message = `Network mismatch: wallet=${storedNetwork}, config=${label}`
  logSdkEvent(SdkLogLevel.Error, message)
  crashlytics().recordError(new Error(message))
  return false
}
