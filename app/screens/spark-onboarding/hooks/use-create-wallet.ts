import { useCallback, useState } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { selfCustodialCreateWallet } from "@app/self-custodial/bridge"
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
  const [status, setStatus] = useState<CreationStatus>(CreationStatus.Idle)

  const create = useCallback(async () => {
    setStatus(CreationStatus.Creating)
    try {
      await selfCustodialCreateWallet()
      updateState((prev) => {
        if (!prev) return prev
        return { ...prev, activeAccountId: DefaultAccountId.SelfCustodial }
      })
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
      )
    } catch {
      setStatus(CreationStatus.Error)
    }
  }, [navigation, updateState])

  return { status, create }
}
