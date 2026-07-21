import {
  Seed,
  connect,
  defaultConfig,
  initLogging,
  MaxFee,
  type BreezSdkInterface,
  type Network,
  type SdkEvent,
} from "@breeztech/breez-sdk-spark-react-native"
import { generateMnemonic, validateMnemonic } from "bip39"
import Crypto from "react-native-quick-crypto"

import { reportError } from "@app/utils/error-logging"
import { normalizeMnemonic } from "@app/utils/mnemonic"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import {
  lnurlDomainFor,
  MAX_SLIPPAGE_BPS,
  networkLabelFor,
  requireBreezApiKey,
  requireSparkTokenIdentifier,
  SparkToken,
  storageDirFor,
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

const createSdkConfig = (network: Network, leewaySatPerVbyte: number) => {
  const config = defaultConfig(network)
  config.apiKey = requireBreezApiKey()
  config.lnurlDomain = lnurlDomainFor(network)

  /**
   * The SDK default cap is 1 sat/vByte, which blocks almost every deposit claim.
   * Track the network-recommended rate plus a small remote-config leeway so
   * automatic claims succeed at normal fees. Coerce to a non-negative integer:
   * BigInt() throws on the fractional values an operator could set remotely.
   */
  const safeLeewaySatPerVbyte = Math.max(0, Math.trunc(leewaySatPerVbyte))
  config.maxDepositClaimFee = new MaxFee.NetworkRecommended({
    leewaySatPerVbyte: BigInt(safeLeewaySatPerVbyte),
  })

  config.stableBalanceConfig = {
    tokens: [{ label: SparkToken.Label, tokenIdentifier: requireSparkTokenIdentifier() }],
    defaultActiveLabel: undefined,
    thresholdSats: undefined,
    maxSlippageBps: MAX_SLIPPAGE_BPS,
  }

  return config
}

type InitSdkParams = {
  mnemonic: string
  storageDir: string
  network: Network
  /** Leeway (sat/vByte) over the network-recommended fee for auto-claiming deposits. */
  leewaySatPerVbyte: number
}

export const initSdk = async ({
  mnemonic,
  storageDir,
  network,
  leewaySatPerVbyte,
}: InitSdkParams): Promise<BreezSdkInterface> => {
  initializeLogging()
  const seed = new Seed.Mnemonic({ mnemonic, passphrase: undefined })
  const config = createSdkConfig(network, leewaySatPerVbyte)
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
  network: Network,
): Promise<void> => {
  const mnemonic = generateMnemonic(128, (size: number) =>
    Buffer.from(Crypto.randomBytes(size)),
  )
  if (!mnemonic) throw new Error("Failed to generate mnemonic")

  const stored = await KeyStoreWrapper.setMnemonicForAccount(accountId, mnemonic)
  if (!stored) throw new Error("Failed to store mnemonic")

  /** Mirror the restore path: a failure after the phrase is written would otherwise leave
   *  orphaned key material in the keychain for an account that never finished registering. */
  try {
    const labelled = await KeyStoreWrapper.setMnemonicNetworkForAccount(
      accountId,
      networkLabelFor(network),
    )
    if (!labelled) throw new Error("Failed to store mnemonic network")
    await addSelfCustodialAccountId(accountId)
  } catch (err) {
    await KeyStoreWrapper.deleteMnemonicForAccount(accountId)
    throw err
  }
}

type RestoreWalletParams = {
  accountId: string
  mnemonic: string
  network: Network
  /** Leeway (sat/vByte) over the network-recommended fee for auto-claiming deposits. */
  leewaySatPerVbyte: number
}

export const selfCustodialRestoreWallet = async ({
  accountId,
  mnemonic,
  network,
  leewaySatPerVbyte,
}: RestoreWalletParams): Promise<void> => {
  const normalized = normalizeMnemonic(mnemonic)
  if (!validateMnemonic(normalized)) {
    throw new Error("Invalid BIP39 mnemonic")
  }

  const stored = await KeyStoreWrapper.setMnemonicForAccount(accountId, normalized)
  if (!stored) throw new Error("Failed to store mnemonic")

  try {
    const labelled = await KeyStoreWrapper.setMnemonicNetworkForAccount(
      accountId,
      networkLabelFor(network),
    )
    if (!labelled) throw new Error("Failed to store mnemonic network")
    const sdk = await initSdk({
      mnemonic: normalized,
      storageDir: storageDirFor(accountId, network),
      network,
      leewaySatPerVbyte,
    })
    await disconnectSdk(sdk)
    await addSelfCustodialAccountId(accountId)
  } catch (err) {
    await KeyStoreWrapper.deleteMnemonicForAccount(accountId)
    reportError("Wallet restore", err)
    throw err
  }
}
