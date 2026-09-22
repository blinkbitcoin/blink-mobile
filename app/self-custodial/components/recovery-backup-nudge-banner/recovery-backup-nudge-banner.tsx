import React, { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RecoveryBackupNudgeVariant } from "@app/self-custodial/hooks/use-recovery-backup-nudge"
import { testProps } from "@app/utils/testProps"

import { NotificationCardUI } from "@app/components/notifications/notification-card-ui"

type Props = {
  variant: RecoveryBackupNudgeVariant
  onDismiss: () => void
}

export const RecoveryBackupNudgeBanner: React.FC<Props> = ({ variant, onDismiss }) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const openRecoveryBackup = useCallback(async () => {
    navigation.navigate("selfCustodialRecoveryBackup")
  }, [navigation])

  const t = LL.RecoveryBundleScreen
  const isMissing = variant === RecoveryBackupNudgeVariant.Missing
  const copy = {
    [RecoveryBackupNudgeVariant.Missing]: {
      title: t.nudgeMissingTitle(),
      body: t.nudgeMissingBody(),
    },
    [RecoveryBackupNudgeVariant.Stale]: {
      title: t.nudgeStaleTitle(),
      body: t.nudgeStaleBody(),
    },
    [RecoveryBackupNudgeVariant.OnlyOnThisDevice]: {
      title: t.nudgeOnlyOnThisDeviceTitle(),
      body: t.nudgeOnlyOnThisDeviceBody(),
    },
  }[variant]

  /** Missing means funds exist with no recovery path at all, which is not a
   *  reminder to be snoozed; only the other variants can be dismissed. */
  const dismissAction = isMissing ? undefined : onDismiss

  return (
    <NotificationCardUI
      title={copy.title}
      text={copy.body}
      action={openRecoveryBackup}
      dismissAction={dismissAction}
      buttonLabel={t.nudgeCta()}
      {...testProps(`recovery-backup-nudge-${variant}`)}
    />
  )
}
