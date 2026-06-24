import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useTransferBlocked } from "./use-transfer-blocked"

export const useTransferBlockedGuard = (): boolean => {
  const isTransferBlocked = useTransferBlocked()
  const navigation = useNavigation()

  useEffect(() => {
    if (!isTransferBlocked) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [isTransferBlocked, navigation])

  return isTransferBlocked
}
