import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useSelfCustodialDisabled } from "@app/screens/account-migration/hooks"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

export const MoveToNonCustodialSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodialDisabled = useSelfCustodialDisabled()

  /** The kill-switch pauses every entry into the migration, this one included. */
  if (isSelfCustodialDisabled) return null
  if (activeAccount?.type === AccountType.SelfCustodial) return null

  /** Routes through the migration entry dispatcher, the single choke point that owns the
   *  resume-vs-fresh decision, instead of deciding it here. */
  const handleMove = () => navigate("accountMigrationEntry")

  return (
    <SettingsRow
      title={LL.AccountMigration.moveToNonCustodial()}
      leftGaloyIcon="arrow-right"
      action={handleMove}
    />
  )
}
