import { type Network } from "@breeztech/breez-sdk-spark-react-native"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { mismatchedNetworkLabel, networkLabelFor } from "../config"
import { logSdkEvent, SdkLogLevel } from "../logging"

export const validateStoredNetwork = async (
  accountId: string,
  network: Network,
): Promise<boolean> => {
  const stored = await KeyStoreWrapper.readMnemonicNetworkWithStatus(accountId)

  // A marker that could not be read is not an account that has none. Scored that
  // way, mismatchedNetworkLabel is handed null, reports no mismatch, and the
  // wallet connects on a network nothing verified. The caller answers false the
  // same way it answers a real mismatch — it has one response either way — so
  // only the log tells the two apart.
  if (stored.status === "failed") {
    // The cause is deliberately left out: a keychain error can carry the server
    // string, which ends in the account id, and no id goes into a log message
    // anywhere in this stack.
    logSdkEvent(SdkLogLevel.Error, "Network marker unreadable, refusing to connect")
    return false
  }

  const storedNetwork = stored.status === "found" ? stored.value : null
  const mismatch = mismatchedNetworkLabel(storedNetwork, network)
  if (!mismatch) return true

  const message = `Network mismatch: wallet=${mismatch}, config=${networkLabelFor(network)}`
  logSdkEvent(SdkLogLevel.Error, message)
  return false
}
