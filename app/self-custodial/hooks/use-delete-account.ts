import { useCallback, useState } from "react"

import crashlytics from "@react-native-firebase/crashlytics"
import RNFS from "react-native-fs"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { disconnectSdk, waitForSdkIdle } from "@app/self-custodial/bridge"
import { storageDirFor } from "@app/self-custodial/config"
import { resetSdkLogs } from "@app/self-custodial/diagnostics/sdk-log-files"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { removeBackupStateFor } from "@app/self-custodial/providers/backup-state"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { removeSelfCustodialAccountId } from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { AccountType, DefaultAccountId } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

type DeleteState = "idle" | "deleting" | "error"

/** How long a deletion waits for the wallet's SDK to finish connecting and shut down
 *  before cutting the log anyway, and exporting nothing more this session. */
export const SDK_TEARDOWN_TIMEOUT_MS = 15_000

export type DeleteAccountOutcome =
  | "remained"
  | "switched-to-self-custodial"
  | "switched-to-custodial"
  | "logged-out"

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

        /** The SDK log mixes every wallet's lines and can't say whose they are, so any
         *  deletion resets it: once every SDK instance of the wallet is gone, a connect
         *  still in flight from before the switch included, so it writes nothing past
         *  the cut; and before the wallet goes, so a stop in between still leaves the
         *  reset to finish. It rejects only when it could neither record nor do the
         *  reset, and then the wallet is kept. */
        const isSdkIdle = await waitForSdkIdle(
          storageDirFor(accountId, network),
          SDK_TEARDOWN_TIMEOUT_MS,
        )
        await resetSdkLogs({ readNothingThisSession: !isSdkIdle })
        await KeyStoreWrapper.deleteMnemonicForAccount(accountId)
        await RNFS.unlink(storageDirFor(accountId, network)).catch((err) => {
          crashlytics().log(`[self-custodial delete] storage dir unlink failed: ${err}`)
        })
        await removeSelfCustodialAccountId(accountId)
        await removeBackupStateFor(accountId)
        await reloadSelfCustodialAccounts()

        setState("idle")

        if (!isActive) return "remained"
        if (remainingSelfCustodial) return "switched-to-self-custodial"
        if (hasCustodialAccount) return "switched-to-custodial"
        return "logged-out"
      } catch (err) {
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
