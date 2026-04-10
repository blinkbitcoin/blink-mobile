import React from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { AccountType } from "@app/types/wallet.types"

import { SettingsRow } from "../row"

export const MoveToNonCustodialSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { loading, getRouteForCheckpoint } = useMigrationCheckpoint()

  if (activeAccount?.type === AccountType.SelfCustodial) return null

  return (
    <SettingsRow
      title={LL.AccountMigration.moveToNonCustodial()}
      leftGaloyIcon="arrow-right"
      loading={loading}
      action={() => navigate(getRouteForCheckpoint())}
    />
  )
}
