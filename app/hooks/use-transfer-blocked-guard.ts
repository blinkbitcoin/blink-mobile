import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useTransferGate } from "./use-transfer-blocked"

type UseTransferBlockedGuardOptions = {
  /** Turns the guard off for a caller that must let a blocked-transfer user through (the
   *  migration's dollar-to-bitcoin conversion). Defaults to on. */
  enabled?: boolean
}

export type TransferBlockedGuard = {
  /** A resolved block, region or Anon. The guard is already resetting to Primary, so the
   *  caller renders nothing rather than flash a screen the user is being taken off. */
  isGated: boolean
  /** The verdict has not landed yet. Kept apart from the block because the two owe the
   *  user different things: a block owes them nothing, a wait owes them a loader. */
  isRegionPending: boolean
}

export const useTransferBlockedGuard = ({
  enabled = true,
}: UseTransferBlockedGuardOptions = {}): TransferBlockedGuard => {
  const { isGated, isRegionPending } = useTransferGate()
  const navigation = useNavigation()

  const shouldLeaveScreen = enabled && isGated

  useEffect(() => {
    if (!shouldLeaveScreen) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [shouldLeaveScreen, navigation])

  return {
    isGated: shouldLeaveScreen,
    isRegionPending: enabled && isRegionPending,
  }
}
