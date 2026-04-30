import { useCallback, useState } from "react"

import { useNavigation, CommonActions } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import crashlytics from "@react-native-firebase/crashlytics"
import RNFS from "react-native-fs"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { disconnectSdk } from "@app/self-custodial/bridge"
import { storageDirFor } from "@app/self-custodial/config"
import { removeBackupStateFor } from "@app/self-custodial/providers/backup-state-provider"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { removeSelfCustodialAccountId } from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { AccountType, DefaultAccountId } from "@app/types/wallet.types"
import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

type DeleteState = "idle" | "deleting" | "error"

type DeleteSelfCustodialResult = {
  state: DeleteState
  error: Error | null
  deleteWallet: (accountId: string) => Promise<void>
}

export const useDeleteSelfCustodial = (): DeleteSelfCustodialResult => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { sdk } = useSelfCustodialWallet()
  const { accounts, activeAccount, setActiveAccountId, reloadSelfCustodialAccounts } =
    useAccountRegistry()
  const { updateState } = usePersistentStateContext()
  const hasCustodialAccount = useHasCustodialAccount()

  const [state, setState] = useState<DeleteState>("idle")
  const [error, setError] = useState<Error | null>(null)

  const deleteWallet = useCallback(
    async (accountId: string) => {
      setState("deleting")
      setError(null)
      try {
        const isActive =
          activeAccount?.type === AccountType.SelfCustodial &&
          activeAccount.id === accountId

        if (isActive && sdk) {
          await disconnectSdk(sdk).catch((err) => {
            crashlytics().log(`[self-custodial delete] disconnect failed: ${err}`)
          })
        }

        await KeyStoreWrapper.deleteMnemonicForAccount(accountId)
        await RNFS.unlink(storageDirFor(accountId)).catch((err) => {
          crashlytics().log(`[self-custodial delete] storage dir unlink failed: ${err}`)
        })
        await removeSelfCustodialAccountId(accountId)
        await removeBackupStateFor(accountId)
        await reloadSelfCustodialAccounts()

        if (!isActive) {
          setState("idle")
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
          )
          return
        }

        const remainingSelfCustodial = accounts.find(
          (a) => a.type === AccountType.SelfCustodial && a.id !== accountId,
        )
        if (remainingSelfCustodial) {
          setActiveAccountId(remainingSelfCustodial.id)
          setState("idle")
          return
        }

        if (hasCustodialAccount) {
          setActiveAccountId(DefaultAccountId.Custodial)
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
          )
          setState("idle")
          return
        }

        updateState((prev) => {
          if (!prev) return prev
          return { ...prev, activeAccountId: undefined }
        })
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "getStarted" }] }),
        )
        setState("idle")
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err))
        reportError("Self-custodial wallet delete", wrapped)
        setState("error")
        setError(wrapped)
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
      navigation,
    ],
  )

  return { state, error, deleteWallet }
}
