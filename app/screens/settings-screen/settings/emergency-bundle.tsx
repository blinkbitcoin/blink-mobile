import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { BackupStatus, useBackupState } from "@app/self-custodial/providers/backup-state"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

// Same guards as BackupWalletSetting: the bundle screen offers the cloud backup
// that keeps it current, which only makes sense once a backup exists.
export const EmergencyBundleSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { backupState } = useBackupState()

  if (activeAccount?.type !== AccountType.SelfCustodial) return null
  if (backupState.status !== BackupStatus.Completed) return null

  return (
    <SettingsRow
      title={LL.BackupScreen.BundleExport.title()}
      leftGaloyIcon="emergency-kit"
      action={() => navigate("selfCustodialBackupBundleExport")}
    />
  )
}
