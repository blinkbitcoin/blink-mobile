import React, { useEffect } from "react"
import { Text } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { Screen } from "@app/components/screen"
import { StatusScreenLayout } from "@app/components/status-screen-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useCompleteMigration } from "@app/screens/account-migration/hooks"
import { reportError } from "@app/utils/error-logging"

// TODO: replace with the backend funds-transfer request; this 3s delay simulates it.
const TRANSFER_SIMULATION_MS = 3000

export const TransferringFundsScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { migrationAccountId, completeMigration } = useCompleteMigration()

  useEffect(() => {
    if (!migrationAccountId) return

    const timer = setTimeout(async () => {
      try {
        if (await completeMigration()) {
          navigation.navigate("selfCustodialBackupSuccess", { reBackup: false })
        }
      } catch (err) {
        /** Funds stay safe on a failed transfer; support resolves it from the contact screen. */
        reportError("Migration funds transfer", err)
        navigation.navigate("accountMigrationContactSupport")
      }
    }, TRANSFER_SIMULATION_MS)

    return () => clearTimeout(timer)
  }, [migrationAccountId, completeMigration, navigation])

  return (
    <Screen preset="fixed">
      <StatusScreenLayout
        icon="clock"
        iconColor={colors.warning}
        iconBackgroundColor={colors._warningLight}
      >
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
