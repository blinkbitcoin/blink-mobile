import React, { useCallback, useEffect, useRef } from "react"
import { Text } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { Screen } from "@app/components/screen"
import { StatusScreenLayout } from "@app/components/status-screen-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  useCompleteMigration,
  useHardwareBackGuard,
} from "@app/screens/account-migration/hooks"
import { MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"

/** TODO: replace with the backend funds-transfer request; this 3s delay simulates it. */
const TRANSFER_SIMULATION_MS = 3000

export const MigrationTransferringFundsScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { migrationAccountId, migrationLoading, completeMigration } =
    useCompleteMigration()

  /** No navigation at all while the funds move. */
  useHardwareBackGuard()

  const goToContactSupport = useCallback(
    (reason: MigrationSupportReason) => {
      navigation.navigate("accountMigrationContactSupport", { reason })
    },
    [navigation],
  )

  /** Completing the transfer clears the checkpoint and swaps the session, so once it starts a
   *  missing provisioned account is the expected outcome, not the fault the guard below
   *  watches for. Without this, the success itself would trip that guard. */
  const hasTransferStartedRef = useRef(false)

  useEffect(() => {
    if (migrationLoading) return

    /** A checkpoint that lost its provisioned account (expired, or a failed write) would
     *  leave this screen spinning forever with every exit blocked, so route to support. */
    if (!migrationAccountId) {
      if (hasTransferStartedRef.current) return
      reportError(
        "Migration transfer without provisioned account",
        new Error("Checkpoint has no accountId"),
      )
      goToContactSupport(MigrationSupportReason.SelfCustodialAccountMissing)
      return
    }

    const timer = setTimeout(async () => {
      hasTransferStartedRef.current = true
      try {
        if (await completeMigration()) {
          /** Point of no return: reset so the finished transfer screen (whose work is done and
           *  which swallows back) is gone from the stack, not left mounted under success. */
          navigation.reset({
            index: 0,
            routes: [{ name: "selfCustodialBackupSuccess", params: { reBackup: false } }],
          })
          return
        }
        goToContactSupport(MigrationSupportReason.TransferFailed)
      } catch (err) {
        /** Funds stay safe on a failed transfer; support resolves it from the contact screen. */
        reportError("Migration funds transfer", err)
        goToContactSupport(MigrationSupportReason.TransferFailed)
      }
    }, TRANSFER_SIMULATION_MS)

    return () => clearTimeout(timer)
  }, [
    migrationLoading,
    migrationAccountId,
    completeMigration,
    navigation,
    goToContactSupport,
  ])

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
