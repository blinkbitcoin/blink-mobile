import React from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  BackupStatus,
  useBackupState,
} from "@app/self-custodial/providers/backup-state-provider"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

export const ViewBackupPhraseSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { backupState } = useBackupState()

  if (activeAccount?.type !== AccountType.SelfCustodial) return null
  if (backupState.status !== BackupStatus.Completed) return null

  return (
    <SettingsRow
      title={LL.BackupScreen.ManualBackup.Phrase.headerTitle()}
      leftGaloyIcon="key-outline"
      action={() => navigate("sparkViewBackupAlertsScreen")}
    />
  )
}
