import React from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"

import { SettingsRow } from "../row"

export const MoveToNonCustodialSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { loading, getRouteForCheckpoint } = useMigrationCheckpoint()

  return (
    <SettingsRow
      title={LL.AccountMigration.moveToNonCustodial()}
      leftGaloyIcon="arrow-right"
      loading={loading}
      action={() => navigate(getRouteForCheckpoint())}
    />
  )
}
