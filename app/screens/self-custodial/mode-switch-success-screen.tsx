import React, { useCallback } from "react"

import { SuccessScreen } from "@app/components/success-screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { AccountMode } from "@app/types/account"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

export const ModeSwitchSuccessScreen = () => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "selfCustodialModeSwitchSuccess">
    >()
  const route =
    useRoute<RouteProp<RootStackParamList, "selfCustodialModeSwitchSuccess">>()

  const { LL } = useI18nContext()
  const message =
    route.params.mode === AccountMode.Anon
      ? LL.ModeSwitchSuccessScreen.anon()
      : LL.ModeSwitchSuccessScreen.enhanced()

  const goBack = useCallback(() => navigation.goBack(), [navigation])

  return <SuccessScreen title={message} onHoldEnd={goBack} />
}
