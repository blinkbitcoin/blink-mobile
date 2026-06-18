import React from "react"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { SettingsRow } from "../row"

export const SwitchAccountSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  return (
    <SettingsRow
      title={LL.AccountScreen.switchAccount()}
      leftGaloyIcon="refresh"
      action={() => navigate("profileScreen")}
    />
  )
}
