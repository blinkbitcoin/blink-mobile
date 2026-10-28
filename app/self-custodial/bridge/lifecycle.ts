import {
  Seed,
  connect,
  defaultConfig,
  MaxFee,
  MaxOnchainFee,
  type BreezSdkInterface,
  type Network,
  type SdkEvent,
} from "@breeztech/breez-sdk-spark-react-native"
import { generateMnemonic, validateMnemonic } from "bip39"
import Crypto from "react-native-quick-crypto"

import { AccountMode } from "@app/types/account"
import { reportError } from "@app/utils/error-logging"
import { normalizeMnemonic } from "@app/utils/mnemonic"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import {
  lnurlDomainFor,
  lnurlServerUrlFor,
  MAX_SLIPPAGE_BPS,
  networkLabelFor,
  requireBreezApiKey,
  requireSparkTokenIdentifier,
  SparkToken,
  storageDirFor,
} from "../config"
import { startSdkLogger } from "../diagnostics/sdk-log-files"
import { recoverLnurlServerMode } from "../lnurl-server-mode"
import { addSelfCustodialAccountId } from "../storage/account-index"

const createSdkConfig = (network: Network, leewaySatPerVbyte: number) => {
  const config = defaultConfig(network)
  config.apiKey = requireBreezApiKey()
  config.lnurlDomain = lnurlDomainFor(network)

  /**
   * The SDK default cap is a fixed 1 sat/vByte (plus 0.1% of the deposit), which
   * blocks claims as soon as on-chain fees rise above it. Track the
   * network-recommended rate plus a small remote-config leeway so automatic claims
   * succeed at normal fees. Coerce to a non-negative integer: BigInt() throws on
   * the fractional values an operator could set remotely.
   *
   * From 0.26 the same cap also admits early claims: the sync loop claims an
   * unconfirmed deposit ahead of maturity whenever the provider's spread fits under
   * this cap, priced as the rate times the SDK's 99 vB claim size.
   *
   * No proportional part (`proportionalPpm`, 0.27), so the ceiling stays what it was
   * before the SDK could express one. Adding one raises it for every claim, early
   * ones included.
   */
  const safeLeewaySatPerVbyte = Math.max(0, Math.trunc(leewaySatPerVbyte))
  config.maxDepositClaimFee = MaxFee.create({
    onchain: new MaxOnchainFee.NetworkRecommended({
      leewaySatPerVbyte: BigInt(safeLeewaySatPerVbyte),
    }),
  })

  /** No SOCKS5 proxy. `getSparkStatus` runs without the SDK and passes its own, so
   *  bridge/status.ts must change with this. */
  config.proxy = undefined

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

/**
 * SDK instances per wallet storage directory, still connecting or live. Every one of them
 * writes to the shared log, so a wallet being deleted keeps adding its lines until all of
 * its instances are gone, including a connect that was in flight when the deletion began.
 * Deletion waits for that before cutting the log (`waitForSdkIdle`).
 */
type SdkPresence = {
  connecting: number
  live: Set<BreezSdkInterface>
  idleWaiters: Array<() => void>
}
const presenceByStorageDir = new Map<string, SdkPresence>()
const storageDirBySdk = new WeakMap<BreezSdkInterface, string>()

const presenceFor = (storageDir: string): SdkPresence => {
  let presence = presenceByStorageDir.get(storageDir)
  if (!presence) {
    presence = { connecting: 0, live: new Set(), idleWaiters: [] }
    presenceByStorageDir.set(storageDir, presence)
  }
  return presence
}

const isIdle = ({ connecting, live }: SdkPresence): boolean =>
  connecting === 0 && live.size === 0

const notifyIfIdle = (presence: SdkPresence): void => {
  if (!isIdle(presence)) return
  const waiters = presence.idleWaiters.splice(0)
  waiters.forEach((resolve) => resolve())
}

/**
 * Resolves true once no SDK instance for `storageDir` is connecting or connected, or false
 * after `timeoutMs`: a connect can hang on the network, and a deletion must not hang with
 * it. An instance whose disconnect failed never counts as gone.
 */
export const waitForSdkIdle = (
  storageDir: string,
  timeoutMs: number,
): Promise<boolean> => {
  const presence = presenceFor(storageDir)
  if (isIdle(presence)) return Promise.resolve(true)
  return new Promise((resolve) => {
    const onIdle = () => {
      clearTimeout(timer)
      resolve(true)
    }
    const timer = setTimeout(() => {
      presence.idleWaiters = presence.idleWaiters.filter((waiter) => waiter !== onIdle)
      resolve(false)
    }, timeoutMs)
    presence.idleWaiters.push(onIdle)
  })
}

export const initSdk = async ({
  mnemonic,
  storageDir,
  network,
  leewaySatPerVbyte,
}: InitSdkParams): Promise<BreezSdkInterface> => {
  const presence = presenceFor(storageDir)
  presence.connecting += 1
  try {
    await startSdkLogger()
    const seed = new Seed.Mnemonic({ mnemonic, passphrase: undefined })
    const config = createSdkConfig(network, leewaySatPerVbyte)
    const sdk = await connect({ config, seed, storageDir })
    presence.live.add(sdk)
    storageDirBySdk.set(sdk, storageDir)
    return sdk
  } finally {
    presence.connecting -= 1
    notifyIfIdle(presence)
  }
}

export const disconnectSdk = async (sdk: BreezSdkInterface): Promise<void> => {
  await sdk.disconnect()
  const storageDir = storageDirBySdk.get(sdk)
  if (storageDir === undefined) return
  const presence = presenceFor(storageDir)
  presence.live.delete(sdk)
  notifyIfIdle(presence)
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

type RestoredWallet = {
  /** The mode the LNURL server holds for this wallet, or null when it holds none. Read
   *  here because this is the one moment the wallet is connected and able to sign. */
  serverMode: AccountMode | null
  /** False when the server could not be asked at all, which is not the same as it
   *  answering "none": a stored Anon may be sitting behind an unanswered request, and
   *  assuming Enhanced would push it away. */
  isServerModeKnown: boolean
}

export const selfCustodialRestoreWallet = async ({
  accountId,
  mnemonic,
  network,
  leewaySatPerVbyte,
}: RestoreWalletParams): Promise<RestoredWallet> => {
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
    /** An unreachable server must not fail the restore: the wallet itself is whole. */
    const recovered = await recoverLnurlServerMode({
      sdk,
      serverUrl: lnurlServerUrlFor(network),
    })
      .then((serverMode) => ({ serverMode, isServerModeKnown: true }))
      .catch((err) => {
        reportError("Wallet restore mode recovery", err)
        return { serverMode: null, isServerModeKnown: false }
      })
    await disconnectSdk(sdk)
    await addSelfCustodialAccountId(accountId)
    return recovered
  } catch (err) {
    await KeyStoreWrapper.deleteMnemonicForAccount(accountId)
    reportError("Wallet restore", err)
    throw err
  }
}
