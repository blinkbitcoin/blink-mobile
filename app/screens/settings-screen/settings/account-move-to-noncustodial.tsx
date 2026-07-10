import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

export const MoveToNonCustodialSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { loading, navigateToCheckpoint, hasResumableCheckpoint } =
    useMigrationCheckpoint()

  if (activeAccount?.type === AccountType.SelfCustodial) return null

  const handleMove = () => {
    if (hasResumableCheckpoint) {
      navigateToCheckpoint()
      return
    }
    navigate("accountMigrationStart")
  }

  return (
    <SettingsRow
      title={LL.AccountMigration.moveToNonCustodial()}
      leftGaloyIcon="arrow-right"
      loading={loading}
      action={handleMove}
    />
  )
}
