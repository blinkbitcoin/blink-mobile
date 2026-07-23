import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useTransferBlocked } from "./use-transfer-blocked"

type UseTransferBlockedGuardOptions = {
  /** Turns the guard off for a caller that must let a blocked-transfer user through (the
   *  migration's dollar-to-bitcoin conversion). Defaults to on. */
  enabled?: boolean
}

export const useTransferBlockedGuard = ({
  enabled = true,
}: UseTransferBlockedGuardOptions = {}): boolean => {
  const isTransferBlocked = useTransferBlocked()
  const navigation = useNavigation()

  const shouldBlock = enabled && isTransferBlocked

  useEffect(() => {
    if (!shouldBlock) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [shouldBlock, navigation])

  return shouldBlock
}
