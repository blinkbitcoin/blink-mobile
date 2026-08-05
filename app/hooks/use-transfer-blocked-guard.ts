import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useTransferGate } from "./use-transfer-blocked"

type UseTransferBlockedGuardOptions = {
  /** Turns the guard off for a caller that must let a blocked-transfer user through (the
   *  migration's dollar-to-bitcoin conversion). Defaults to on. */
  enabled?: boolean
}

export const useTransferBlockedGuard = ({
  enabled = true,
}: UseTransferBlockedGuardOptions = {}): boolean => {
  const { isGated, isRegionPending } = useTransferGate()
  const navigation = useNavigation()

  const shouldLeaveScreen = enabled && isGated

  useEffect(() => {
    if (!shouldLeaveScreen) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [shouldLeaveScreen, navigation])

  /** The screen also hides while the region resolves, so a user who lands here on a cold
   *  start cannot act on it before the verdict arrives; only a resolved gate bounces them
   *  out. */
  return enabled && (isGated || isRegionPending)
}
