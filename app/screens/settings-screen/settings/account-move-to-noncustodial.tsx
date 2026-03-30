import React from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { SettingsRow } from "../row"

export const MoveToNonCustodialSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()

  return (
    <SettingsRow
      title={LL.SparkMigration.moveToNonCustodial()}
      leftGaloyIcon="arrow-right"
      action={() => navigate("sparkMigrationExplainer")}
    />
  )
}
