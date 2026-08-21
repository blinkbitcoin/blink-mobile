import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useDollarBalanceRestriction } from "./use-dollar-balance-restricted"

type UseDollarBalanceRestrictionGuardOptions = {
  /** Turns the guard off for a caller that must let a restricted user through (the
   *  migration's dollar-to-bitcoin conversion). Defaults to on. */
  enabled?: boolean
}

export type DollarBalanceRestrictionGuard = {
  /** A resolved refusal. The guard is already resetting to Primary, so the caller renders
   *  nothing rather than flash a screen the user is being taken off. */
  isRestricted: boolean
  /** The verdict has not landed yet. Kept apart from the refusal because the two owe the
   *  user different things: a refusal owes them nothing, a wait owes them a loader. */
  isRegionPending: boolean
}

export const useDollarBalanceRestrictionGuard = ({
  enabled = true,
}: UseDollarBalanceRestrictionGuardOptions = {}): DollarBalanceRestrictionGuard => {
  const { isRestricted, isRegionPending } = useDollarBalanceRestriction()
  const navigation = useNavigation()

  const shouldLeaveScreen = enabled && isRestricted

  useEffect(() => {
    if (!shouldLeaveScreen) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [shouldLeaveScreen, navigation])

  return {
    isRestricted: shouldLeaveScreen,
    isRegionPending: enabled && isRegionPending,
  }
}
