import React, { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { NotificationCardUI } from "../notifications/notification-card-ui"

type BackupNudgeBannerProps = {
  onDismiss: () => void
}

export const BackupNudgeBanner: React.FC<BackupNudgeBannerProps> = ({ onDismiss }) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const handleAction = useCallback(async () => {
    navigation.navigate("selfCustodialBackupMethod")
  }, [navigation])

  return (
    <NotificationCardUI
      title={LL.BackupNudge.title()}
      text={LL.BackupNudge.description()}
      action={handleAction}
      dismissAction={onDismiss}
      buttonLabel={LL.BackupNudge.cta()}
      {...testProps("backup-nudge-banner")}
    />
  )
}
