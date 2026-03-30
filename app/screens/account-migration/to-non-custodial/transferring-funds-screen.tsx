import React, { useEffect } from "react"
import { Text } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { StatusScreenLayout } from "@app/components/status-screen-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const TransferringFundsScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  // TODO: replace with real funds transfer logic
  useEffect(() => {
    const timeout = setTimeout(() => {
      navigation.replace("sparkBackupSuccessScreen")
    }, 2000)
    return () => clearTimeout(timeout)
  }, [navigation])

  return (
    <Screen preset="fixed">
      <StatusScreenLayout icon="clock" iconBackgroundColor={colors._warningLight}>
        <Text style={styles.message}>{LL.AccountMigration.transferringFunds()}</Text>
      </StatusScreenLayout>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  message: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "400",
    color: colors.black,
    textAlign: "center",
  },
}))
