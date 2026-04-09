import {
  Network,
  Seed,
  StableBalanceActiveLabel,
  connect,
  defaultConfig,
  initLogging,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import { generateMnemonic } from "bip39"
import Crypto from "react-native-quick-crypto"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { SparkConfig, SparkToken } from "./config"
import { createSdkLogListener } from "./logging"

const initializeLogging = (() => {
  let done = false
  return () => {
    if (done) return
    done = true
    initLogging(undefined, createSdkLogListener(), undefined)
  }
})()

const createSdkConfig = () => {
  const config = defaultConfig(SparkConfig.network)
  config.apiKey = SparkConfig.apiKey

  if (SparkConfig.tokenIdentifier) {
    config.stableBalanceConfig = {
      tokens: [{ label: SparkToken.Label, tokenIdentifier: SparkConfig.tokenIdentifier }],
      defaultActiveLabel: undefined,
      thresholdSats: undefined,
      maxSlippageBps: SparkConfig.maxSlippageBps,
    }
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

export const selfCustodialCreateWallet = async (): Promise<string> => {
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

  const networkLabel = SparkConfig.network === Network.Mainnet ? "mainnet" : "regtest"
  await KeyStoreWrapper.setMnemonicNetwork(networkLabel)

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

  return mnemonic
}

export const selfCustodialRestoreWallet = async (mnemonic: string): Promise<void> => {
  const stored = await KeyStoreWrapper.setMnemonic(mnemonic)
  if (!stored) throw new Error("Failed to store mnemonic")

  const networkLabel = SparkConfig.network === Network.Mainnet ? "mainnet" : "regtest"
  await KeyStoreWrapper.setMnemonicNetwork(networkLabel)
}
