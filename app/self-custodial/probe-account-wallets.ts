import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

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
): Promise<ProbeAccountWalletsResult> => {
  const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
  if (!mnemonic) return { status: ProbeAccountWalletsStatus.NoMnemonic }

  let sdk: BreezSdkInterface | undefined
  try {
    sdk = await initSdk(mnemonic, storageDirFor(accountId))
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
