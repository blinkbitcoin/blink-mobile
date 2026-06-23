import { useEffect } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"

import { useStablesatsRestricted } from "./use-stablesats-restricted"

export const useStablesatsRestrictionGuard = (): boolean => {
  const isRestricted = useStablesatsRestricted()
  const navigation = useNavigation()

  useEffect(() => {
    if (!isRestricted) return
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [isRestricted, navigation])

  return isRestricted
}
