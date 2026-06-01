import {
  Network,
  Seed,
  connect,
  defaultConfig,
  initLogging,
  type BreezSdkInterface,
  type SdkEvent,
} from "@breeztech/breez-sdk-spark-react-native"
import { generateMnemonic, validateMnemonic } from "bip39"
import Crypto from "react-native-quick-crypto"

import { reportError } from "@app/utils/error-logging"
import { normalizeMnemonic } from "@app/utils/mnemonic"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import {
  requireSparkTokenIdentifier,
  sparkNetworkLabelFromNetwork,
  type SparkNetworkLabel,
  SparkConfig,
  SparkToken,
} from "../config"
import { createSdkLogListener } from "../logging"
import { addSelfCustodialAccountId } from "../storage/account-index"

const initializeLogging = (() => {
  let done = false
  return () => {
    if (done) return
    done = true
    try {
      initLogging(undefined, createSdkLogListener(), undefined)
    } catch {
      // initLogging can fail if called after SDK state changes; non-fatal
    }
  }
})()

const createSdkConfig = (network: Network) => {
  const config = defaultConfig(network)
  config.apiKey = SparkConfig.apiKey

  config.stableBalanceConfig = {
    tokens: [{ label: SparkToken.Label, tokenIdentifier: requireSparkTokenIdentifier() }],
    defaultActiveLabel: undefined,
    thresholdSats: undefined,
    maxSlippageBps: SparkConfig.maxSlippageBps,
  }

  return config
}

export const initSdk = async (
  mnemonic: string,
  storageDir: string,
  network: Network,
): Promise<BreezSdkInterface> => {
  initializeLogging()
  const seed = new Seed.Mnemonic({ mnemonic, passphrase: undefined })
  const config = createSdkConfig(network)
  return connect({ config, seed, storageDir })
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

export const selfCustodialCreateWallet = async (
  accountId: string,
  networkLabel: SparkNetworkLabel,
): Promise<void> => {
  const mnemonic = generateMnemonic(128, (size: number) =>
    Buffer.from(Crypto.randomBytes(size)),
  )
  if (!mnemonic) throw new Error("Failed to generate mnemonic")

  const stored = await KeyStoreWrapper.setMnemonicForAccount(accountId, mnemonic)
  if (!stored) throw new Error("Failed to store mnemonic")

  await KeyStoreWrapper.setMnemonicNetworkForAccount(accountId, networkLabel)
  await addSelfCustodialAccountId(accountId)
}

export const selfCustodialRestoreWallet = async ({
  accountId,
  mnemonic,
  network,
  storageDir,
}: {
  accountId: string
  mnemonic: string
  network: Network
  storageDir: string
}): Promise<void> => {
  const networkLabel = sparkNetworkLabelFromNetwork(network)
  const normalized = normalizeMnemonic(mnemonic)
  if (!validateMnemonic(normalized)) {
    throw new Error("Invalid BIP39 mnemonic")
  }

  const stored = await KeyStoreWrapper.setMnemonicForAccount(accountId, normalized)
  if (!stored) throw new Error("Failed to store mnemonic")

  try {
    await KeyStoreWrapper.setMnemonicNetworkForAccount(accountId, networkLabel)
    const sdk = await initSdk(normalized, storageDir, network)
    await disconnectSdk(sdk)
    await addSelfCustodialAccountId(accountId)
  } catch (err) {
    await KeyStoreWrapper.deleteMnemonicForAccount(accountId)
    reportError("Wallet restore", err)
    throw err
  }
}
