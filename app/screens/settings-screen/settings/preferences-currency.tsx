import React from "react"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { SettingsRow } from "../row"

export const CurrencySetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { displayCurrency } = useDisplayCurrency()

  return (
    <SettingsRow
      title={`${LL.SettingsScreen.displayCurrency()}: ${displayCurrency}`}
      leftGaloyIcon="dollar"
      action={() => navigate("currency")}
    />
  )
}
