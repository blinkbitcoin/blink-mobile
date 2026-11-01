import { useCallback } from "react"

import { Network } from "@breeztech/breez-sdk-spark-react-native"
import RNFS from "react-native-fs"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { canDropAppLock } from "@app/hooks/use-logout"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { disconnectSdk } from "@app/self-custodial/bridge"
import { storageDirFor } from "@app/self-custodial/config"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { errorKind, logBreadcrumb } from "@app/utils/error-reporting"
import { removeBackupStateFor } from "@app/self-custodial/providers/backup-state"
import {
  markAccountDeletedForRefresh,
  unmarkAccountDeletedForRefresh,
  waitForRefreshesToSettle,
} from "@app/self-custodial/recovery-bundle/refresh"
import {
  deleteRecoveryBundleFile,
  removeRecoveryBundleState,
} from "@app/self-custodial/recovery-bundle/storage"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import {
  readStoredWalletPresence,
  removeSelfCustodialAccountId,
  StoredWalletPresence,
} from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { AccountType, DefaultAccountId } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

/** Where the active account ended up. `remained` means it was not the one removed. */
export type DeleteAccountOutcome =
  | "remained"
  | "switched-to-self-custodial"
  | "switched-to-custodial"
  | "logged-out"
  /** Nothing is left to sign back in with, but the lock outlived the wipe: it is still owed
   *  an answer, so this one may not land on the screen that opens a new account. */
  | "logged-out-locked"

/** The switch happens before anything that can fail, so a failed removal still reports
 *  it: the caller has to follow the switch either way, or leave the user on a screen that
 *  already describes the next account. `logged-out` vs `logged-out-locked` is the one
 *  part that is only known once the wipe has tried to drop the lock, so a failure of the
 *  last account reports `logged-out-locked`: the lock was not taken. */
export type DeleteAccountResult = {
  removed: boolean
  outcome: DeleteAccountOutcome
}

/**
 * Erases one wallet from the device: its seed, its index entry, its SDK storage on this
 * network, its recovery-bundle files on both networks and its backup record. Returns whether
 * the seed is gone.
 *
 * The index entry goes right after the seed and only with it. A wallet whose seed survived
 * stays listed, so a later removal, the forgotten-PIN one included, finds it and tries again
 * instead of reading an empty index as a device with nothing left to lock. What comes after
 * is cleanup a failure leaves behind, so none of it can keep a wallet listed once its seed
 * is gone, which a retry could never undo.
 *
 * The caller disconnects the SDK first, after moving the active account off this wallet, so
 * the SDK lifecycle tears down through its own effect cleanup.
 */
export const eraseWalletFromDevice = async (
  accountId: string,
  network: Network,
): Promise<boolean> => {
  try {
    // Before sweeping: an in-flight bundle refresh must refuse to persist
    // its result, or the files would reappear after the sweep for an
    // account no longer in the registry.
    markAccountDeletedForRefresh(accountId)

    const isSeedGone = await KeyStoreWrapper.deleteMnemonicForAccount(accountId)
    if (isSeedGone) await removeSelfCustodialAccountId(accountId)

    await RNFS.unlink(storageDirFor(accountId, network)).catch((err) => {
      logBreadcrumb(
        `[self-custodial delete] storage dir unlink failed (${errorKind(err)})`,
      )
    })
    // Best-effort: leftover recovery-bundle files must not block deletion.
    // Both networks are swept - the account may have been used on the
    // other network under a different galoy instance.
    const sweepRecoveryBundleFiles = async () => {
      for (const bundleNetwork of [Network.Mainnet, Network.Regtest]) {
        await deleteRecoveryBundleFile(accountId, bundleNetwork)
          .then(() => removeRecoveryBundleState(accountId, bundleNetwork))
          .catch((err) => {
            logBreadcrumb(
              `[self-custodial delete] recovery bundle cleanup failed (${errorKind(err)})`,
            )
          })
      }
    }
    await sweepRecoveryBundleFiles()
    await removeBackupStateFor(accountId).catch((err) => {
      logBreadcrumb(
        `[self-custodial delete] backup state cleanup failed (${errorKind(err)})`,
      )
    })
    // A refresh already past its deleted-account check can still write
    // after the sweep above; once every in-flight run settles, sweep
    // again in the background so the deletion stays complete. Not
    // awaited - a mid-fetch refresh can take tens of seconds and must
    // not block the delete UX.
    waitForRefreshesToSettle(accountId)
      .then(sweepRecoveryBundleFiles)
      .catch((err) => {
        logBreadcrumb(
          `[self-custodial delete] post-refresh bundle re-sweep failed (${errorKind(err)})`,
        )
      })
      .finally(() => {
        // Bounds the deleted-accounts set: nothing can start a refresh
        // once the mnemonic and registry entry are gone.
        unmarkAccountDeletedForRefresh(accountId)
      })
    return isSeedGone
  } catch (err) {
    /**
     * The background re-sweep is what drops the deletion mark, and it is the last step, so
     * a failure always lands before it is scheduled. Left behind, the mark would refuse
     * every later refresh of an account that may still be registered until the app restarts.
     */
    unmarkAccountDeletedForRefresh(accountId)
    throw err
  }
}

/** Known before the wipe. The last account starts as `logged-out-locked`: the lock is
 *  still standing until the wipe itself takes it. */
const outcomeOf = ({
  isActive,
  hasRemainingSelfCustodial,
  hasCustodialAccount,
}: {
  isActive: boolean
  hasRemainingSelfCustodial: boolean
  hasCustodialAccount: boolean
}): DeleteAccountOutcome => {
  if (!isActive) return "remained"
  if (hasRemainingSelfCustodial) return "switched-to-self-custodial"
  if (hasCustodialAccount) return "switched-to-custodial"
  return "logged-out-locked"
}

type UseDeleteAccountResult = {
  deleteWallet: (accountId: string) => Promise<DeleteAccountResult>
}

export const useDeleteAccount = (): UseDeleteAccountResult => {
  const { sdk } = useSelfCustodialWallet()
  const { accounts, activeAccount, setActiveAccountId, reloadSelfCustodialAccounts } =
    useAccountRegistry()
  const { updateState, clearToken } = usePersistentStateContext()
  const hasCustodialAccount = useHasCustodialAccount()

  const network = useSparkNetwork()

  const deleteWallet = useCallback(
    async (accountId: string): Promise<DeleteAccountResult> => {
      const isActive =
        activeAccount?.type === AccountType.SelfCustodial &&
        activeAccount.id === accountId

      const remainingSelfCustodial = accounts.find(
        (a) => a.type === AccountType.SelfCustodial && a.id !== accountId,
      )

      let outcome = outcomeOf({
        isActive,
        hasRemainingSelfCustodial: Boolean(remainingSelfCustodial),
        hasCustodialAccount,
      })

      try {
        /**
         * Switch the active account before disconnecting the SDK so
         * useSdkLifecycle tears down via its own effect cleanup. Disconnecting
         * first leaves the lifecycle's stale sdkRef in place and lets the 10s
         * poll and backoff retries hammer it, flipping wallet status to Offline
         * mid-delete.
         */
        if (isActive && remainingSelfCustodial) {
          setActiveAccountId(remainingSelfCustodial.id)
        }
        if (isActive && !remainingSelfCustodial && hasCustodialAccount) {
          setActiveAccountId(DefaultAccountId.Custodial)
        }
        if (isActive && !remainingSelfCustodial && !hasCustodialAccount) {
          updateState((prev) => {
            if (!prev) return prev
            return { ...prev, activeAccountId: undefined }
          })
        }

        if (isActive && sdk) {
          await disconnectSdk(sdk).catch((err) => {
            logBreadcrumb(`[self-custodial delete] disconnect failed (${errorKind(err)})`)
          })
        }

        /** A seed that survived keeps its wallet listed, so nothing was deleted and the
         *  owner is told so rather than shown a wallet gone that the device still holds. */
        const isSeedGone = await eraseWalletFromDevice(accountId, network)
        await reloadSelfCustodialAccounts()
        if (!isSeedGone) throw new Error("The wallet's seed survived its deletion")

        /**
         * Deleting the last account ends like a full logout, so the lock follows the same
         * rule (`canDropAppLock`): it goes once nothing it guards is left. Each question is
         * answered by the store that holds the thing, and each fails closed:
         *
         * - The wallets are asked of the index, which drops an entry only with its seed.
         * - The active token is erased, not read, the same evidence a logout goes by. With
         *   no custodial account left, a token the keychain still holds is one an earlier
         *   erase missed.
         * - The saved profiles are asked on their own: a logout that preserved them leaves
         *   live bearer tokens with no active one. They are read rather than erased, since
         *   erasing them would end sessions a logout kept on purpose, so a read that cannot
         *   answer counts as sessions still saved.
         */
        const isLastAccountGone = !remainingSelfCustodial && !hasCustodialAccount
        let isAppLockKept = true

        if (isLastAccountGone) {
          const [presence, hasNoActiveToken, savedSessions] = await Promise.all([
            readStoredWalletPresence(),
            clearToken(),
            KeyStoreWrapper.readSessionProfiles(),
          ])

          const hasNoStoredWallet = presence === StoredWalletPresence.Absent
          const hasNoSavedSession =
            savedSessions.status === "absent" ||
            (savedSessions.status === "found" && savedSessions.profiles.length === 0)

          const hasNothingLeftToGuard = canDropAppLock({
            hasNoStoredWallet,
            hasNoSavedSession,
            hasNoActiveToken,
          })

          if (hasNothingLeftToGuard) {
            /** A slot that would not erase leaves the lock half gone, which routes every
             *  later unlock to the keypad instead of the prompt its owner chose. It is
             *  reported and the lock goes on counting as set, so the way out below still
             *  passes the gate. */
            isAppLockKept = !(await KeyStoreWrapper.clearAppLock())
            if (isAppLockKept) {
              reportError(
                "Self-custodial delete app lock clear",
                new Error("App lock survived the last wallet's deletion"),
              )
            }
          }

          if (!isAppLockKept) outcome = "logged-out"
        }

        return { removed: true, outcome }
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err))
        reportError("Self-custodial wallet delete", wrapped)
        return { removed: false, outcome }
      }
    },
    [
      sdk,
      activeAccount,
      accounts,
      setActiveAccountId,
      reloadSelfCustodialAccounts,
      updateState,
      clearToken,
      hasCustodialAccount,
      network,
    ],
  )

  return { deleteWallet }
}
