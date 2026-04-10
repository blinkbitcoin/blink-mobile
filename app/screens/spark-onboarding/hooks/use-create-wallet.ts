import { useCallback, useState } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import crashlytics from "@react-native-firebase/crashlytics"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { selfCustodialCreateWallet } from "@app/self-custodial/bridge"
import { useBackupState } from "@app/self-custodial/providers/backup-state-provider"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { DefaultAccountId } from "@app/types/wallet.types"

export const CreationStatus = {
  Idle: "idle",
  Creating: "creating",
  Error: "error",
} as const

type CreationStatus = (typeof CreationStatus)[keyof typeof CreationStatus]

export const useCreateWallet = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { updateState } = usePersistentStateContext()
  const { retry: reinitSdk } = useSelfCustodialWallet()
  const { resetBackupState } = useBackupState()
  const [status, setStatus] = useState<CreationStatus>(CreationStatus.Idle)

  const create = useCallback(async () => {
    setStatus(CreationStatus.Creating)
    try {
      await selfCustodialCreateWallet()
      reinitSdk()
      resetBackupState()
      updateState((prev) => {
        if (!prev) return prev
        return { ...prev, activeAccountId: DefaultAccountId.SelfCustodial }
      })
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
      )
    } catch (err) {
      crashlytics().recordError(
        err instanceof Error ? err : new Error(`Wallet creation failed: ${err}`),
      )
      setStatus(CreationStatus.Error)
    }
  }, [navigation, updateState])

  return { status, create }
}
