import React, { useCallback, useEffect, useRef } from "react"
import { Text } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { Screen } from "@app/components/screen"
import { StatusScreenLayout } from "@app/components/status-screen-layout"
import { useCustodialOwnerId } from "@app/screens/account-migration/hooks/use-custodial-owner-id"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  useCompleteMigration,
  useHardwareBackGuard,
} from "@app/screens/account-migration/hooks"
import { useMigrationTransfer } from "@app/screens/account-migration/hooks/use-migration-transfer"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

export const MigrationTransferringFundsScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const LLMigration = LL.AccountMigration
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { ownerId } = useCustodialOwnerId()
  const {
    migrationAccountId,
    migrationExpectedReceiveSats,
    migrationLoading,
    completeMigration,
  } = useCompleteMigration()

  /** No navigation at all while the funds move. */
  useHardwareBackGuard()

  /** Every failure handover leaves this screen for good, so Back belongs on the commit
   *  screen: the transfer is over and this one has nothing left to offer. */
  const goToContactSupport = useCallback(
    (reason: MigrationSupportReason) => {
      navigation.navigate("accountMigrationContactSupport", {
        reason,
        origin: MigrationSupportOrigin.Commit,
      })
    },
    [navigation],
  )

  /** The delayed handover is the one the user comes back from: the receive is still being
   *  watched here, so its Back returns to this screen rather than popping it off the stack
   *  along with the gate that is still waiting. */
  const goToDelayedSupport = useCallback(() => {
    navigation.navigate("accountMigrationContactSupport", {
      reason: MigrationSupportReason.ReceiveDelayed,
      origin: MigrationSupportOrigin.ReceiveDelayed,
    })
  }, [navigation])

  /** Completing the transfer clears the checkpoint and swaps the session, so once it
   *  succeeds a missing provisioned account is the expected outcome, not the fault this
   *  screen watches for. Without this, the success itself would trip that guard. */
  const hasSwappedRef = useRef(false)
  const hasProvisionedAccount = Boolean(migrationAccountId)
  const isAccountMissing =
    !migrationLoading && !hasProvisionedAccount && !hasSwappedRef.current

  const isTransferSkipped = migrationLoading || isAccountMissing
  const {
    isTransferred,
    isReceiveDelayed,
    failureReason,
    isClockOutOfSync,
    hasConnectionIssue,
    retry,
  } = useMigrationTransfer({
    custodialAccountId: ownerId,
    selfCustodialAccountId: migrationAccountId,
    expectedReceiveSats: migrationExpectedReceiveSats,
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

        /** Point of no return: reset so the finished transfer screen (whose work is done
         *  and which swallows back) is gone from the stack, not left mounted under success
         *  where a back press before success auto-navigates home would land on it. */
        navigation.reset({
          index: 0,
          routes: [{ name: "selfCustodialBackupSuccess", params: { reBackup: false } }],
        })
      })
      .catch((err) => {
        reportError("Migration session swap", err)
        goToContactSupport(MigrationSupportReason.TransferFailed)
      })
  }, [isTransferred, completeMigration, navigation, goToContactSupport])

  /** Two recoverable states share the retry footer: a skewed clock and a lost connection.
   *  Each keeps its own message; only a real failure leaves this screen for support. */
  const isRecoverable = isClockOutOfSync || hasConnectionIssue

  /** The delayed notice yields to a recoverable issue: a lost connection explains the
   *  wait better than the wait itself, and its retry is the more useful footer. */
  const isDelayedNoticeShown = isReceiveDelayed && !isRecoverable

  /**
   * Past the notice window the handover happens on its own rather than waiting for the user
   * to find the button. It costs them nothing: this screen stays mounted underneath and the
   * gate keeps polling, so a receive that lands afterwards still completes the swap — the
   * handover explains the wait, it does not abandon it. Once only, so returning from support
   * to watch the wait out is not immediately undone.
   */
  const hasHandedOverDelayRef = useRef(false)
  useEffect(() => {
    if (!isDelayedNoticeShown || hasHandedOverDelayRef.current) return
    hasHandedOverDelayRef.current = true
    goToDelayedSupport()
  }, [isDelayedNoticeShown, goToDelayedSupport])

  const recoverableMessage = isClockOutOfSync
    ? LLMigration.clockOutOfSync.body()
    : LL.errors.network.connection()
  const waitingMessage = isDelayedNoticeShown
    ? LLMigration.transferDelayed.body()
    : LLMigration.transferringFunds()
  const message = isRecoverable ? recoverableMessage : waitingMessage

  const retryTitle = isClockOutOfSync
    ? LLMigration.clockOutOfSync.retryCta()
    : LL.common.tryAgain()
  const retryTestId = isClockOutOfSync
    ? "migration-clock-out-of-sync-retry"
    : "migration-connection-issue-retry"

  const recoverableFooter = (
    <GaloyPrimaryButton title={retryTitle} onPress={retry} {...testProps(retryTestId)} />
  )

  /** Secondary, not primary: waiting stays the recommended path — the swap still fires
   *  the moment the receive lands, including while the support screen sits on top (this
   *  screen stays mounted beneath it, exactly like the failure handover). */
  const delayedFooter = (
    <GaloySecondaryButton
      title={LLMigration.transferDelayed.contactSupportCta()}
      onPress={goToDelayedSupport}
      {...testProps("migration-receive-delayed-contact-support")}
    />
  )

  const waitingFooter = isDelayedNoticeShown ? delayedFooter : undefined
  const screenFooter = isRecoverable ? recoverableFooter : waitingFooter

  return (
    <Screen preset="fixed">
      <StatusScreenLayout
        icon="clock"
        iconColor={colors.warning}
        iconBackgroundColor={colors._warningLight}
        footer={screenFooter}
      >
        <Text style={styles.message}>{message}</Text>
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
