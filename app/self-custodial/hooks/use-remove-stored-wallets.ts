import { useCallback } from "react"

import crashlytics from "@react-native-firebase/crashlytics"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import useLogout from "@app/hooks/use-logout"
import { disconnectSdk } from "@app/self-custodial/bridge"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import {
  listSelfCustodialAccounts,
  readStoredWalletPresence,
  removeSelfCustodialAccountId,
  StorageReadStatus,
  StoredWalletPresence,
} from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { reportError } from "@app/utils/error-logging"

import { eraseWalletFromDevice } from "./use-delete-account"

export type RemoveStoredWalletsResult = {
  /** Every wallet the device stored is gone, seed included, and the logout ran. */
  readonly isEveryWalletRemoved: boolean
  /** The logout's own answer: the lock goes only once nothing it guards is left. */
  readonly isAppLockKept: boolean
}

const NOTHING_REMOVED: RemoveStoredWalletsResult = {
  isEveryWalletRemoved: false,
  isAppLockKept: true,
}

/**
 * The way out for an owner who forgot the PIN on a device that stores a wallet. Every
 * wallet is removed from the device and then the session is logged out, so the lock goes
 * with what it guarded and nothing is left behind it for whoever holds the phone. A wallet
 * comes back only with its backup phrase, which is why the screens ask before calling this.
 *
 * Fails closed. A wallet whose seed would not erase stays listed, and an index that cannot
 * be read erases nothing. Either way the logout does not run and the lock stays, because a
 * device that still stores a wallet is the case the lock is kept for.
 */
export const useRemoveStoredWallets = (): (() => Promise<RemoveStoredWalletsResult>) => {
  const { sdk } = useSelfCustodialWallet()
  const network = useSparkNetwork()
  const { updateState } = usePersistentStateContext()
  const { reloadSelfCustodialAccounts } = useAccountRegistry()
  const { logout } = useLogout()

  return useCallback(async (): Promise<RemoveStoredWalletsResult> => {
    const listed = await listSelfCustodialAccounts()
    if (listed.status === StorageReadStatus.ReadFailed) return NOTHING_REMOVED

    /** Off the wallet before its SDK goes, so the lifecycle tears down through its own
     *  effect cleanup rather than retrying against a disconnected instance. */
    updateState((prev) => prev && { ...prev, activeAccountId: undefined })
    if (sdk) {
      await disconnectSdk(sdk).catch((err) => {
        crashlytics().log(`[self-custodial remove wallets] disconnect failed: ${err}`)
      })
    }

    for (const { id } of listed.entries) {
      try {
        const isSeedErased = await eraseWalletFromDevice(id, network)
        if (isSeedErased) await removeSelfCustodialAccountId(id)
      } catch (err) {
        reportError("Self-custodial remove stored wallets", err)
      }
    }
    await reloadSelfCustodialAccounts()

    /** Asked of the index rather than counted above: an entry whose removal did not land
     *  is a wallet the next launch still lists. */
    const presence = await readStoredWalletPresence()
    if (presence !== StoredWalletPresence.Absent) return NOTHING_REMOVED

    const { isAppLockKept } = await logout()
    return { isEveryWalletRemoved: true, isAppLockKept }
  }, [sdk, network, updateState, reloadSelfCustodialAccounts, logout])
}
