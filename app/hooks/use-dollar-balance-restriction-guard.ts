import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useDollarBalanceRestricted } from "./use-dollar-balance-restricted"

export const useDollarBalanceRestrictionGuard = (): boolean => {
  const isRestricted = useDollarBalanceRestricted()
  const navigation = useNavigation()

  useEffect(() => {
    if (!isRestricted) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [isRestricted, navigation])

  return isRestricted
}
