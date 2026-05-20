import React, { useCallback } from "react"

import { makeStyles, Text } from "@rn-vui/themed"
import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"

import { Screen } from "@app/components/screen"
import { SuccessScreenLayout } from "@app/components/success-screen-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"

type SuccessRouteProp = RouteProp<RootStackParamList, "sparkBackupSuccessScreen">

export const SparkBackupSuccessScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation()
  const { clearCheckpoint } = useMigrationCheckpoint()
  const reBackup = useRoute<SuccessRouteProp>().params?.reBackup ?? false

  const navigateToHome = useCallback(() => {
    clearCheckpoint()
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [navigation, clearCheckpoint])

  const message = reBackup
    ? LL.common.success()
    : LL.BackupScreen.ManualBackup.Success.title()

  return (
    <Screen preset="fixed">
      <SuccessScreenLayout onAnimationComplete={navigateToHome}>
        <Text style={styles.message}>{message}</Text>
      </SuccessScreenLayout>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  message: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    width: 264,
  },
}))
