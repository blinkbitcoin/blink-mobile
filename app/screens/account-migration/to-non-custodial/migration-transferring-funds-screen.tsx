import React, { useCallback, useEffect, useRef } from "react"
import { Text } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { Screen } from "@app/components/screen"
import { StatusScreenLayout } from "@app/components/status-screen-layout"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  useCompleteMigration,
  useHardwareBackGuard,
} from "@app/screens/account-migration/hooks"
import { useMigrationTransfer } from "@app/screens/account-migration/hooks/use-migration-transfer"
import { MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"

export const MigrationTransferringFundsScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
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

  /** Completing the transfer clears the checkpoint and swaps the session, so once it
   *  succeeds a missing provisioned account is the expected outcome, not the fault this
   *  screen watches for. Without this, the success itself would trip that guard. */
  const hasSwappedRef = useRef(false)
  const hasProvisionedAccount = Boolean(migrationAccountId)
  const isAccountMissing =
    !migrationLoading && !hasProvisionedAccount && !hasSwappedRef.current

  const isTransferSkipped = migrationLoading || isAccountMissing
  const { isTransferred, failureReason } = useMigrationTransfer({
    custodialAccountId: activeAccount?.id ?? null,
    selfCustodialAccountId: migrationAccountId,
    skip: isTransferSkipped,
  })

  useEffect(() => {
    if (!isAccountMissing) return
    reportError(
      "Migration transfer without provisioned account",
      new Error("Checkpoint has no accountId"),
    )
    goToContactSupport(MigrationSupportReason.SelfCustodialAccountMissing)
  }, [isAccountMissing, goToContactSupport])

  useEffect(() => {
    if (!failureReason) return
    goToContactSupport(failureReason)
  }, [failureReason, goToContactSupport])

  /** The session swap is the last step and it is local: the funds have already landed,
   *  so a failure here leaves a completed migration the next launch can still finish. */
  useEffect(() => {
    if (!isTransferred || hasSwappedRef.current) return
    hasSwappedRef.current = true

    completeMigration()
      .then((hasSwapped) => {
        if (!hasSwapped) {
          goToContactSupport(MigrationSupportReason.SelfCustodialAccountMissing)
          return
        }
        navigation.navigate("selfCustodialBackupSuccess", { reBackup: false })
      })
      .catch((err) => {
        reportError("Migration session swap", err)
        goToContactSupport(MigrationSupportReason.TransferFailed)
      })
  }, [isTransferred, completeMigration, navigation, goToContactSupport])

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
