import {
  Network,
  Seed,
  StableBalanceActiveLabel,
  connect,
  defaultConfig,
  initLogging,
  type BreezSdkInterface,
  type SdkEvent,
} from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import { generateMnemonic, validateMnemonic } from "bip39"
import Crypto from "react-native-quick-crypto"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import {
  requireSparkTokenIdentifier,
  SparkConfig,
  SparkNetworkLabel,
  SparkToken,
} from "../config"
import { createSdkLogListener } from "../logging"

const initializeLogging = (() => {
  let done = false
  return () => {
    if (done) return
    done = true
    try {
      initLogging(undefined, createSdkLogListener(), undefined)
    } catch {
      // initLogging can fail if called after SDK state changes — non-fatal
    }
  }
})()

const createSdkConfig = () => {
  const config = defaultConfig(SparkConfig.network)
  config.apiKey = SparkConfig.apiKey

  config.stableBalanceConfig = {
    tokens: [{ label: SparkToken.Label, tokenIdentifier: requireSparkTokenIdentifier() }],
    defaultActiveLabel: undefined,
    thresholdSats: undefined,
    maxSlippageBps: SparkConfig.maxSlippageBps,
  }

  return config
}

export const initSdk = async (mnemonic: string): Promise<BreezSdkInterface> => {
  initializeLogging()
  const seed = new Seed.Mnemonic({ mnemonic, passphrase: undefined })
  const config = createSdkConfig()
  return connect({ config, seed, storageDir: SparkConfig.storageDir })
}

export const disconnectSdk = async (sdk: BreezSdkInterface): Promise<void> => {
  await sdk.disconnect()
}

export const addSdkEventListener = (
  sdk: BreezSdkInterface,
  onEvent: (event: SdkEvent) => Promise<void>,
) => sdk.addEventListener({ onEvent })

export const removeSdkEventListener = (sdk: BreezSdkInterface, listenerId: string) =>
  sdk.removeEventListener(listenerId)

export const selfCustodialCreateWallet = async (): Promise<void> => {
  if (!__DEV__) {
    throw new Error(
      "Wallet creation is disabled in production builds until backup flow is available",
    )
  }

  if (__DEV__ && SparkConfig.network === Network.Mainnet) {
    throw new Error(
      "Wallet creation is disabled on mainnet in debug builds. Set BREEZ_NETWORK=regtest",
    )
  }

  const mnemonic = generateMnemonic(128, (size: number) =>
    Buffer.from(Crypto.randomBytes(size)),
  )
  if (!mnemonic) throw new Error("Failed to generate mnemonic")

  const stored = await KeyStoreWrapper.setMnemonic(mnemonic)
  if (!stored) throw new Error("Failed to store mnemonic")

  await KeyStoreWrapper.setMnemonicNetwork(SparkNetworkLabel)

  try {
    const sdk = await initSdk(mnemonic)
    try {
      await sdk.updateUserSettings({
        sparkPrivateModeEnabled: undefined,
        stableBalanceActiveLabel: new StableBalanceActiveLabel.Set({
          label: SparkToken.Label,
        }),
      })
    } finally {
      await disconnectSdk(sdk)
    }
  } catch (err) {
    await KeyStoreWrapper.deleteMnemonic()
    crashlytics().recordError(
      err instanceof Error ? err : new Error(`Wallet creation failed: ${err}`),
    )
    throw err
  }
}

export const selfCustodialRestoreWallet = async (mnemonic: string): Promise<void> => {
  const trimmed = mnemonic.trim().replace(/\s+/g, " ")
  if (!validateMnemonic(trimmed)) {
    throw new Error("Invalid BIP39 mnemonic")
  }

  const stored = await KeyStoreWrapper.setMnemonic(trimmed)
  if (!stored) throw new Error("Failed to store mnemonic")

  try {
    await KeyStoreWrapper.setMnemonicNetwork(SparkNetworkLabel)
    const sdk = await initSdk(trimmed)
    await disconnectSdk(sdk)
  } catch (err) {
    // Roll back the stored mnemonic so a key the SDK can't actually use never
    // latches onto the device.
    await KeyStoreWrapper.deleteMnemonic()
    crashlytics().recordError(
      err instanceof Error ? err : new Error(`Wallet restore failed: ${err}`),
    )
    throw err
  }
}
