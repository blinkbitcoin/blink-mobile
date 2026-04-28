import { useCallback, useState } from "react"

import { useNavigation, CommonActions } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import crashlytics from "@react-native-firebase/crashlytics"

import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { disconnectSdk } from "@app/self-custodial/bridge"
import { useBackupState } from "@app/self-custodial/providers/backup-state-provider"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
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
      resetBackupState()

      if (hasCustodialAccount) {
        setActiveAccountId(DefaultAccountId.Custodial)
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
        )
      } else {
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
  }, [sdk, resetBackupState, setActiveAccountId, hasCustodialAccount, navigation])

  return { state, error, deleteWallet }
}
