import crashlytics from "@react-native-firebase/crashlytics"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { SparkNetworkLabel } from "../config"
import { logSdkEvent, SdkLogLevel } from "../logging"

export const validateStoredNetwork = async (accountId: string): Promise<boolean> => {
  const storedNetwork = await KeyStoreWrapper.getMnemonicNetworkForAccount(accountId)
  if (!storedNetwork) return true
  if (storedNetwork === SparkNetworkLabel) return true

  const message = `Network mismatch: wallet=${storedNetwork}, config=${SparkNetworkLabel}`
  logSdkEvent(SdkLogLevel.Error, message)
  crashlytics().recordError(new Error(message))
  return false
}
