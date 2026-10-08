import { useCallback, useState } from "react"

import crashlytics from "@react-native-firebase/crashlytics"
import RNFS from "react-native-fs"

import { isLocalInstance } from "@app/config/galoy-instances"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import {
  getPendingAccountsStorageKey,
  readPendingProvisionedAccounts,
} from "@app/screens/account-migration/utils/migration-checkpoint-storage"
import { disconnectSdk } from "@app/self-custodial/bridge"
import { storageDirFor } from "@app/self-custodial/config"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { removeBackupStateFor } from "@app/self-custodial/providers/backup-state"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import {
  removeSelfCustodialAccountId,
  StorageReadStatus,
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
  /** Nothing was touched: a migration still owes this wallet its funds, and the key that
   *  reaches them is the thing deletion destroys. */
  | "blocked"
  /** Nothing was touched either, but for a different reason: the record that would answer
   *  could not be read, so whether a migration owes this wallet is unknown. Kept apart from
   *  `blocked` because the two are not the same thing to say to a user. */
  | "record-unavailable"

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
  const {
    appConfig: {
      galoyInstance: { id: instanceId, name: environment },
    },
  } = useAppConfig()

  const deleteWallet = useCallback(
    async (accountId: string): Promise<DeleteAccountOutcome | undefined> => {
      /**
       * The policy lives in useMigrationDeletionGuard, which every delete control consults
       * before offering itself; this is the same question asked where the destruction
       * actually happens, so a surface that forgets the guard still cannot take the key to
       * funds in flight. Read fresh rather than from React state: the answer must be the
       * one true at this instant.
       *
       * Read strictly, and refuse on anything short of a clean answer. A store that could
       * not be read and a record that will not parse both leave this wallet's mark unknown,
       * which here would be a storage fault granting permission to destroy the only key to
       * funds in flight. A missing key is still an answer, and still means there is nothing
       * to protect.
       *
       * Exempt on the Local instance only, matching the guard: Staging is where the flow is
       * tested, so the refusal has to be real there.
       */
      if (!isLocalInstance(instanceId)) {
        const pending = await readPendingProvisionedAccounts(
          getPendingAccountsStorageKey(environment),
        )
        if (pending.status !== StorageReadStatus.Ok) return "record-unavailable"

        const isAwaitingMigrationFunds = Object.values(pending.pendingByOwner).includes(
          accountId,
        )
        if (isAwaitingMigrationFunds) return "blocked"
      }

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
      environment,
      instanceId,
    ],
  )

  return { state, error, deleteWallet }
}
