import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

// Every self-custodial wallet keeps its bundle on the device, backed up or not,
// so the row shows for all of them. A wallet that has never held funds has no
// bundle yet; the screen says so and keeps Download disabled.
export const EmergencyBundleSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()

  if (activeAccount?.type !== AccountType.SelfCustodial) return null

  return (
    <SettingsRow
      title={LL.BackupScreen.BundleExport.title()}
      leftGaloyIcon="emergency-kit"
      action={() => navigate("selfCustodialBackupBundleExport")}
    />
  )
}
