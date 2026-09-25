import {
  type BreezSdkInterface,
  type Network,
} from "@breeztech/breez-sdk-spark-react-native"

import { type WalletState } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { disconnectSdk, initSdk } from "./bridge"
import { storageDirFor } from "./config"
import { getSelfCustodialWalletSnapshot } from "./providers/wallet-snapshot"

export const ProbeAccountWalletsStatus = {
  Ok: "ok",
  NoMnemonic: "no-mnemonic",
  ProbeFailed: "probe-failed",
} as const

export type ProbeAccountWalletsStatus =
  (typeof ProbeAccountWalletsStatus)[keyof typeof ProbeAccountWalletsStatus]

export type ProbeAccountWalletsResult =
  | { status: typeof ProbeAccountWalletsStatus.Ok; wallets: WalletState[] }
  | { status: typeof ProbeAccountWalletsStatus.NoMnemonic }
  | { status: typeof ProbeAccountWalletsStatus.ProbeFailed; error: Error }

const toProbeFailed = (err: unknown): ProbeAccountWalletsResult => ({
  status: ProbeAccountWalletsStatus.ProbeFailed,
  error: err instanceof Error ? err : new Error(String(err)),
})

/**
 * Returns a discriminated result so callers can route probe failures
 * explicitly; falling through silently would skip the has-funds warning
 * on the delete flow.
 */
export const probeSelfCustodialAccountWallets = async (
  accountId: string,
  network: Network,
  leewaySatPerVbyte: number,
): Promise<ProbeAccountWalletsResult> => {
  // Read with its status rather than through getMnemonicForAccount, which answers
  // null for both "no mnemonic" and "the read failed". Collapsed here, a keychain
  // that merely refused one read reports NoMnemonic, the delete flow skips the
  // has-funds warning, and the erase that follows still succeeds — a delete does
  // not decrypt, so it reaches a seed this probe could not.
  const stored = await KeyStoreWrapper.readMnemonicWithStatus(accountId)
  // The cause is dropped on purpose: profile-row reports this error straight to
  // Crashlytics, and a keychain error can carry the server string, which ends in
  // the account id.
  if (stored.status === "failed") return toProbeFailed(new Error("Mnemonic read failed"))
  if (stored.status === "absent") return { status: ProbeAccountWalletsStatus.NoMnemonic }
  const mnemonic = stored.value

  let sdk: BreezSdkInterface | undefined
  try {
    sdk = await initSdk({
      mnemonic,
      storageDir: storageDirFor(accountId, network),
      network,
      leewaySatPerVbyte,
    })
    const snapshot = await getSelfCustodialWalletSnapshot(sdk)
    return { status: ProbeAccountWalletsStatus.Ok, wallets: snapshot.wallets }
  } catch (err) {
    return toProbeFailed(err)
  } finally {
    if (sdk) {
      await disconnectSdk(sdk).catch((err) => {
        reportError("Probe SDK disconnect", err)
      })
    }
  }
}
