import React from "react"
import { useI18nContext } from "@app/i18n/i18n-react"

import { SettingsRow } from "../row"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const ApiAccessSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()

  return (
    <SettingsRow
      title={LL.SettingsScreen.apiAcess()}
      leftGaloyIcon="document-outline"
      action={() => navigate("apiScreen")}
    />
  )
}
