import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useDollarBalanceRestricted } from "./use-dollar-balance-restricted"

type UseDollarBalanceRestrictionGuardOptions = {
  /** Turns the guard off for a caller that must let a restricted user through (the
   *  migration's dollar-to-bitcoin conversion). Defaults to on. */
  enabled?: boolean
}

export const useDollarBalanceRestrictionGuard = ({
  enabled = true,
}: UseDollarBalanceRestrictionGuardOptions = {}): boolean => {
  const isRestricted = useDollarBalanceRestricted()
  const navigation = useNavigation()

  const shouldBlock = enabled && isRestricted

  useEffect(() => {
    if (!shouldBlock) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [shouldBlock, navigation])

  return shouldBlock
}
