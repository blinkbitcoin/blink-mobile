import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useStableTokenTransferBlocked } from "./use-stable-token-transfer-blocked"

export const useStableTokenTransferBlockedGuard = (): boolean => {
  const isTransferBlocked = useStableTokenTransferBlocked()
  const navigation = useNavigation()

  useEffect(() => {
    if (!isTransferBlocked) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [isTransferBlocked, navigation])

  return isTransferBlocked
}
