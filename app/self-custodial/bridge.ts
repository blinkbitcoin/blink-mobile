import {
  Network,
  Seed,
  StableBalanceActiveLabel,
  connect,
  defaultConfig,
  initLogging,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"
import { generateMnemonic } from "bip39"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { SparkConfig, SparkToken } from "./config"
import { createSdkLogListener } from "./logging"

initLogging(undefined, createSdkLogListener(), undefined)

const createSdkConfig = () => {
  const config = defaultConfig(Network.Mainnet)
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
  const seed = new Seed.Mnemonic({ mnemonic, passphrase: undefined })
  const config = createSdkConfig()
  const sdk = await connect({ config, seed, storageDir: SparkConfig.storageDir })

  return sdk
}

export const disconnectSdk = async (sdk: BreezSdkInterface): Promise<void> => {
  await sdk.disconnect()
}

export const selfCustodialCreateWallet = async (): Promise<string> => {
  const mnemonic = generateMnemonic()
  if (!mnemonic) throw new Error("Failed to generate mnemonic")

  const stored = await KeyStoreWrapper.setMnemonic(mnemonic)
  if (!stored) throw new Error("Failed to store mnemonic")

  const seed = new Seed.Mnemonic({ mnemonic, passphrase: undefined })
  const config = createSdkConfig()
  const sdk = await connect({
    config,
    seed,
    storageDir: SparkConfig.storageDir,
  })

  try {
    await sdk.updateUserSettings({
      sparkPrivateModeEnabled: undefined,
      stableBalanceActiveLabel: new StableBalanceActiveLabel.Set({
        label: SparkToken.Label,
      }),
    })
  } finally {
    await sdk.disconnect()
  }

  return mnemonic
}

export const selfCustodialRestoreWallet = async (mnemonic: string): Promise<void> => {
  const stored = await KeyStoreWrapper.setMnemonic(mnemonic)
  if (!stored) throw new Error("Failed to store mnemonic")
}
