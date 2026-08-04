import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useDollarBalanceRestriction } from "./use-dollar-balance-restricted"

type UseDollarBalanceRestrictionGuardOptions = {
  /** Turns the guard off for a caller that must let a restricted user through (the
   *  migration's dollar-to-bitcoin conversion). Defaults to on. */
  enabled?: boolean
}

export const useDollarBalanceRestrictionGuard = ({
  enabled = true,
}: UseDollarBalanceRestrictionGuardOptions = {}): boolean => {
  const { isRestricted, isRegionPending } = useDollarBalanceRestriction()
  const navigation = useNavigation()

  const shouldLeaveScreen = enabled && isRestricted

  useEffect(() => {
    if (!shouldLeaveScreen) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [shouldLeaveScreen, navigation])

  /** The screen also hides while the region resolves, so a user who lands here on a cold
   *  start cannot act on it before the verdict arrives; only a resolved restriction
   *  bounces them out. */
  return enabled && (isRestricted || isRegionPending)
}
