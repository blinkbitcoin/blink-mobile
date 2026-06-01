import crashlytics from "@react-native-firebase/crashlytics"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { type SparkNetworkLabel } from "../config"
import { logSdkEvent, SdkLogLevel } from "../logging"

export const validateStoredNetwork = async (
  accountId: string,
  networkLabel: SparkNetworkLabel,
): Promise<boolean> => {
  const storedNetwork = await KeyStoreWrapper.getMnemonicNetworkForAccount(accountId)
  if (!storedNetwork) return true
  if (storedNetwork === networkLabel) return true

  const message = `Network mismatch: wallet=${storedNetwork}, config=${networkLabel}`
  logSdkEvent(SdkLogLevel.Error, message)
  crashlytics().recordError(new Error(message))
  return false
}
