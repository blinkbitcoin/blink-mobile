import { useCallback, useState } from "react"

import { Network } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import RNFS from "react-native-fs"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
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
         * The same rule a full logout applies, for the one deletion that ends like one: a
         * lock is kept for as long as the device still stores something it guards, and with
         * the last wallet gone there is nothing left behind it. A lock with nothing behind
         * it only locks its owner out, and since every launch now opens at the gate it
         * would ask on each one before landing on the screen it was always going to land on.
         *
         * Four questions, each answered by the store that actually holds the thing, and
         * each failing closed:
         *
         * The wallet this call just deleted counts only if its erase said so. The index
         * entry is removed either way, so an erase that failed would otherwise leave the
         * mnemonic on the device with the index reporting nothing stored.
         *
         * Reading the slot back is not the answer: that read collapses "absent" and
         * "unreadable" into null on both platforms, so a seed whose erase and read both
         * failed would score as gone. The cost of asking for the erase itself is that a
         * wallet whose key was already missing keeps the lock, which is friction rather
         * than exposure.
         *
         * The active token is read from the keychain, never from the in-memory mirror. That
         * field is blanked by `clearToken` and by `resetState` whatever the keychain did, so
         * a logout whose keychain erase failed, the one case where the logout deliberately
         * keeps the lock, would read as no token at all.
         *
         * The saved profiles are asked separately: a logout that preserved stored
         * credentials leaves the token gone with live bearer tokens still beside it, and the
         * landing screen this deletion ends on offers them.
         *
         * Known limit: on iOS a legacy-store read cannot tell a missing key from a failed
         * one, so `absent` is weaker there than on Android. It narrows to devices whose
         * slots have not migrated yet, since the Keychain-backed store does separate the
         * two, and it is the same degradation every other reader of these slots already
         * accepts.
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

          const hasNothingLeftToGuard =
            isMnemonicErased && hasNoStoredWallet && hasNoActiveToken && hasNoSavedSession

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
