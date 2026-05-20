import React, { useCallback } from "react"

import { makeStyles, Text } from "@rn-vui/themed"
import { CommonActions, useNavigation } from "@react-navigation/native"

import { Screen } from "@app/components/screen"
import { SuccessScreenLayout } from "@app/components/success-screen-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"

export const SparkBackupSuccessScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation()
  const { clearCheckpoint } = useMigrationCheckpoint()

  const navigateToHome = useCallback(() => {
    clearCheckpoint()
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [navigation, clearCheckpoint])

  return (
    <Screen preset="fixed">
      <SuccessScreenLayout onAnimationComplete={navigateToHome}>
        <Text style={styles.message}>
          {LL.SparkOnboarding.ManualBackup.Success.title()}
        </Text>
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
