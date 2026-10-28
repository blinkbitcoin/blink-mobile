import { useCallback, useState } from "react"

import { Network } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import RNFS from "react-native-fs"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { canDropAppLock } from "@app/hooks/use-logout"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { disconnectSdk } from "@app/self-custodial/bridge"
import { storageDirFor } from "@app/self-custodial/config"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
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

type DeleteState = "idle" | "deleting" | "error"

export type DeleteAccountOutcome =
  | "remained"
  | "switched-to-self-custodial"
  | "switched-to-custodial"
  | "logged-out"
  /** Nothing is left to sign back in with, but the lock outlived the wipe: it is still owed
   *  an answer, so this one may not land on the screen that opens a new account. */
  | "logged-out-locked"

type DeleteAccountResult = {
  state: DeleteState
  error: Error | null
  deleteWallet: (accountId: string) => Promise<DeleteAccountOutcome | undefined>
}

export const useDeleteAccount = (): DeleteAccountResult => {
  const { sdk } = useSelfCustodialWallet()
  const { accounts, activeAccount, setActiveAccountId, reloadSelfCustodialAccounts } =
    useAccountRegistry()
  const { updateState } = usePersistentStateContext()
  const hasCustodialAccount = useHasCustodialAccount()

  const [state, setState] = useState<DeleteState>("idle")
  const [error, setError] = useState<Error | null>(null)
  const network = useSparkNetwork()

  const deleteWallet = useCallback(
    async (accountId: string): Promise<DeleteAccountOutcome | undefined> => {
      setState("deleting")
      setError(null)
      let isResweepScheduled = false
      try {
        const isActive =
          activeAccount?.type === AccountType.SelfCustodial &&
          activeAccount.id === accountId

        const remainingSelfCustodial = accounts.find(
          (a) => a.type === AccountType.SelfCustodial && a.id !== accountId,
        )

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
            crashlytics().log(`[self-custodial delete] disconnect failed: ${err}`)
          })
        }

        // Before sweeping: an in-flight bundle refresh must refuse to persist
        // its result, or the files would reappear after the sweep for an
        // account no longer in the registry.
        markAccountDeletedForRefresh(accountId)

        const isMnemonicErased = await KeyStoreWrapper.deleteMnemonicForAccount(accountId)
        await RNFS.unlink(storageDirFor(accountId, network)).catch((err) => {
          crashlytics().log(`[self-custodial delete] storage dir unlink failed: ${err}`)
        })
        // Best-effort: leftover recovery-bundle files must not block deletion.
        // Both networks are swept - the account may have been used on the
        // other network under a different galoy instance.
        const sweepRecoveryBundleFiles = async () => {
          for (const bundleNetwork of [Network.Mainnet, Network.Regtest]) {
            await deleteRecoveryBundleFile(accountId, bundleNetwork)
              .then(() => removeRecoveryBundleState(accountId, bundleNetwork))
              .catch((err) => {
                crashlytics().log(
                  `[self-custodial delete] recovery bundle cleanup failed: ${err}`,
                )
              })
          }
        }
        await sweepRecoveryBundleFiles()
        // A refresh already past its deleted-account check can still write
        // after the sweep above; once every in-flight run settles, sweep
        // again in the background so the deletion stays complete. Not
        // awaited - a mid-fetch refresh can take tens of seconds and must
        // not block the delete UX.
        waitForRefreshesToSettle(accountId)
          .then(sweepRecoveryBundleFiles)
          .catch((err) => {
            crashlytics().log(
              `[self-custodial delete] post-refresh bundle re-sweep failed: ${err}`,
            )
          })
          .finally(() => {
            // Bounds the deleted-accounts set: nothing can start a refresh
            // once the mnemonic and registry entry are gone.
            unmarkAccountDeletedForRefresh(accountId)
          })
        isResweepScheduled = true
        await removeSelfCustodialAccountId(accountId)
        await removeBackupStateFor(accountId)
        await reloadSelfCustodialAccounts()

        /**
         * Deleting the last account ends like a full logout, so the lock follows the same
         * rule (`canDropAppLock`): it goes once nothing it guards is left. Each question is
         * answered by the store that holds the thing, and each fails closed:
         *
         * - The deleted wallet counts as gone only if its erase said so. Its index entry
         *   goes either way, and a read-back cannot tell an absent key from an unreadable
         *   one on either platform.
         * - The active token is read from the keychain, not the in-memory mirror, which
         *   `clearToken` and `resetState` blank whatever the keychain did.
         * - The saved profiles are asked on their own: a logout that preserved them leaves
         *   live bearer tokens with no active one.
         *
         * Known limit: an unmigrated iOS legacy slot cannot tell a missing key from a
         * failed read, so `absent` is weaker there, as it is for every reader of it.
         */
        const isLastAccountGone = !remainingSelfCustodial && !hasCustodialAccount
        let isAppLockKept = true

        if (isLastAccountGone) {
          const [presence, activeToken, savedSessions] = await Promise.all([
            readStoredWalletPresence(),
            KeyStoreWrapper.readActiveToken(),
            KeyStoreWrapper.readSessionProfiles(),
          ])

          const hasNoStoredWallet = presence === StoredWalletPresence.Absent
          const hasNoActiveToken = activeToken.status === "absent"
          const hasNoSavedSession =
            savedSessions.status === "absent" ||
            (savedSessions.status === "found" && savedSessions.profiles.length === 0)

          const hasNothingLeftToGuard = canDropAppLock({
            hasNoStoredWallet: isMnemonicErased && hasNoStoredWallet,
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
        }

        setState("idle")

        if (!isActive) return "remained"
        if (remainingSelfCustodial) return "switched-to-self-custodial"
        if (hasCustodialAccount) return "switched-to-custodial"

        return isAppLockKept ? "logged-out-locked" : "logged-out"
      } catch (err) {
        /**
         * Once scheduled, the background re-sweep drops the deletion mark. A
         * failure before that point would leave the mark behind, and every
         * later refresh of an account that may still be registered would be
         * refused until the app restarts.
         */
        if (!isResweepScheduled) unmarkAccountDeletedForRefresh(accountId)
        const wrapped = err instanceof Error ? err : new Error(String(err))
        reportError("Self-custodial wallet delete", wrapped)
        setState("error")
        setError(wrapped)
        return undefined
      }
    },
    [
      sdk,
      activeAccount,
      accounts,
      setActiveAccountId,
      reloadSelfCustodialAccounts,
      updateState,
      hasCustodialAccount,
      network,
    ],
  )

  return { state, error, deleteWallet }
}
