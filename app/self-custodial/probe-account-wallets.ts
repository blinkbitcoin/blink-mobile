import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { type WalletState } from "@app/types/wallet.types"

import { disconnectSdk, initSdk } from "./bridge"
import { storageDirFor } from "./config"
import { getSelfCustodialWalletSnapshot } from "./providers/wallet-snapshot"

/**
 * Connects a short-lived SDK instance using the account's stored mnemonic
 * solely to read its balance, then disconnects. Does not touch the active
 * account selection.
 */
export const probeSelfCustodialAccountWallets = async (
  accountId: string,
): Promise<WalletState[] | null> => {
  const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
  if (!mnemonic) return null

  const sdk = await initSdk(mnemonic, storageDirFor(accountId))
  try {
    const snapshot = await getSelfCustodialWalletSnapshot(sdk)
    return snapshot.wallets
  } finally {
    await disconnectSdk(sdk).catch(() => undefined)
  }
}
