import React, { useCallback } from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"
import { CommonActions, useNavigation } from "@react-navigation/native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { SuccessIconAnimation } from "@app/components/success-animation/success-icon-animation"
import { CompletedTextAnimation } from "@app/components/success-animation/success-text-animation"
import { useI18nContext } from "@app/i18n/i18n-react"

export const SparkBackupSuccessScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation()

  const navigateToHome = useCallback(() => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [navigation])

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <SuccessIconAnimation>
          <GaloyIcon name="payment-success" size={100} />
        </SuccessIconAnimation>
        <CompletedTextAnimation onComplete={navigateToHome}>
          <Text style={styles.message}>
            {LL.SparkOnboarding.ManualBackup.Success.title()}
          </Text>
        </CompletedTextAnimation>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 26,
  },
  message: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    width: 264,
  },
}))
