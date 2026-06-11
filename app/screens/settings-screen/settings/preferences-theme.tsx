import React from "react"
import { useEffectiveTheme } from "@app/hooks/use-effective-theme"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { SettingsRow } from "../row"

export const ThemeSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { theme } = useEffectiveTheme()
  let label = LL.SettingsScreen.setByOs()

  switch (theme) {
    case "light":
      label = LL.ThemeScreen.setToLight()
      break
    case "dark":
      label = LL.ThemeScreen.setToDark()
      break
  }

  return (
    <SettingsRow
      title={`${LL.SettingsScreen.theme()}: ${label}`}
      leftGaloyIcon="brush"
      action={() => navigate("theme")}
    />
  )
}
