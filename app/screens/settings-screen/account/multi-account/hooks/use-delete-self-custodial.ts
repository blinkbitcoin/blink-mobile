import { useCallback, useState } from "react"

import { useNavigation, CommonActions } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import crashlytics from "@react-native-firebase/crashlytics"
import RNFS from "react-native-fs"

import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { disconnectSdk } from "@app/self-custodial/bridge"
import { SparkConfig } from "@app/self-custodial/config"
import { useBackupState } from "@app/self-custodial/providers/backup-state-provider"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { DefaultAccountId } from "@app/types/wallet.types"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

type DeleteState = "idle" | "deleting" | "error"

type DeleteSelfCustodialResult = {
  state: DeleteState
  error: Error | null
  deleteWallet: () => Promise<void>
}

export const useDeleteSelfCustodial = (): DeleteSelfCustodialResult => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { sdk } = useSelfCustodialWallet()
  const { resetBackupState } = useBackupState()
  const { setActiveAccountId } = useAccountRegistry()
  const { updateState } = usePersistentStateContext()
  const hasCustodialAccount = useHasCustodialAccount()

  const [state, setState] = useState<DeleteState>("idle")
  const [error, setError] = useState<Error | null>(null)

  const deleteWallet = useCallback(async () => {
    setState("deleting")
    setError(null)
    try {
      if (sdk) {
        await disconnectSdk(sdk).catch((err) => {
          crashlytics().log(`[self-custodial delete] disconnect failed: ${err}`)
        })
      }
      await KeyStoreWrapper.deleteMnemonic()
      await RNFS.unlink(SparkConfig.storageDir).catch((err) => {
        crashlytics().log(`[self-custodial delete] storage dir unlink failed: ${err}`)
      })
      resetBackupState()

      if (hasCustodialAccount) {
        setActiveAccountId(DefaultAccountId.Custodial)
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
        )
      } else {
        updateState((prev) => {
          if (!prev) return prev
          return { ...prev, activeAccountId: undefined }
        })
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "getStarted" }] }),
        )
      }

      setState("idle")
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err))
      crashlytics().recordError(wrapped)
      setState("error")
      setError(wrapped)
    }
  }, [
    sdk,
    resetBackupState,
    setActiveAccountId,
    updateState,
    hasCustodialAccount,
    navigation,
  ])

  return { state, error, deleteWallet }
}
