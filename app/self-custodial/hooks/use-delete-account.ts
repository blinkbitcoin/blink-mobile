import { useCallback } from "react"

import crashlytics from "@react-native-firebase/crashlytics"
import RNFS from "react-native-fs"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { disconnectSdk } from "@app/self-custodial/bridge"
import { storageDirFor } from "@app/self-custodial/config"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { removeBackupStateFor } from "@app/self-custodial/providers/backup-state"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { removeSelfCustodialAccountId } from "@app/self-custodial/storage/account-index"
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

/** The switch happens before anything that can fail, so a failed removal still reports
 *  it: the caller has to follow the switch either way, or leave the user on a screen that
 *  already describes the next account. */
export type DeleteAccountResult = {
  removed: boolean
  outcome: DeleteAccountOutcome
}

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
  return "logged-out"
}

type UseDeleteAccountResult = {
  deleteWallet: (accountId: string) => Promise<DeleteAccountResult>
}

export const useDeleteAccount = (): UseDeleteAccountResult => {
  const { sdk } = useSelfCustodialWallet()
  const { accounts, activeAccount, setActiveAccountId, reloadSelfCustodialAccounts } =
    useAccountRegistry()
  const { updateState } = usePersistentStateContext()
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

      const outcome = outcomeOf({
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
            crashlytics().log(`[self-custodial delete] disconnect failed: ${err}`)
          })
        }

        await KeyStoreWrapper.deleteMnemonicForAccount(accountId)
        await RNFS.unlink(storageDirFor(accountId, network)).catch((err) => {
          crashlytics().log(`[self-custodial delete] storage dir unlink failed: ${err}`)
        })
        await removeSelfCustodialAccountId(accountId)
        await removeBackupStateFor(accountId)
        await reloadSelfCustodialAccounts()

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
      hasCustodialAccount,
      network,
    ],
  )

  return { deleteWallet }
}
