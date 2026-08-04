import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { StatusPill, type StatusPillVariant } from "@app/components/status-pill"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  RecoveryBundleStatus,
  useRecoveryBundleStatus,
} from "@app/self-custodial/hooks/use-recovery-bundle-status"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

export const RecoveryBackupSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { status } = useRecoveryBundleStatus()

  if (activeAccount?.type !== AccountType.SelfCustodial) return null

  /** Unknown means the first read has not landed; a chip that guessed would
   *  flash the wrong state on every visit to Settings. */
  const chip: Record<
    RecoveryBundleStatus,
    { label: string; status: StatusPillVariant } | null
  > = {
    [RecoveryBundleStatus.Unknown]: null,
    [RecoveryBundleStatus.Fresh]: {
      label: LL.RecoveryBundleScreen.chipFresh(),
      status: "success",
    },
    [RecoveryBundleStatus.Stale]: {
      label: LL.RecoveryBundleScreen.chipStale(),
      status: "warning",
    },
    [RecoveryBundleStatus.Missing]: {
      label: LL.RecoveryBundleScreen.chipMissing(),
      status: "primary",
    },
  }
  const pill = chip[status]

  return (
    <SettingsRow
      title={LL.RecoveryBundleScreen.settingsTitle()}
      leftGaloyIcon="shield"
      extraComponentBesideTitle={
        pill ? (
          <StatusPill
            label={pill.label}
            status={pill.status}
            testID="recovery-backup-chip"
          />
        ) : (
          <></>
        )
      }
      action={() => navigate("selfCustodialRecoveryBackup")}
    />
  )
}
