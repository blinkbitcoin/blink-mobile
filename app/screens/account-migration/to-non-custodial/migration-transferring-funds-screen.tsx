import React, { useCallback, useEffect, useRef, useState } from "react"
import { Text } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { Screen } from "@app/components/screen"
import { StatusScreenLayout } from "@app/components/status-screen-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  useCompleteMigration,
  useHardwareBackGuard,
} from "@app/screens/account-migration/hooks"
import { useMigrationTransfer } from "@app/screens/account-migration/hooks/use-migration-transfer"
import {
  MigrationCompletion,
  MigrationSupportOrigin,
  MigrationSupportReason,
} from "@app/types/migration"
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

  /** The custodial id comes from the completion hook rather than a second owner query of
   *  this screen's own: two no-cache reads of the same id can disagree for a render after
   *  an account switch, and the close and the handover that names it must never be stamped
   *  with different accounts. */
  const {
    migrationAccountId,
    migrationExpectedReceiveSats,
    custodialAccountId,
    migrationLoading,
    completeMigration,
  } = useCompleteMigration()

  /** No navigation at all while the funds move. */
  useHardwareBackGuard()

  /** Every failure handover leaves this screen for good, so Back belongs on the commit
   *  screen: the transfer is over and this one has nothing left to offer. The id travels
   *  with every handover, including the ones raised after the session was discarded, where
   *  the support screen has nothing left to query it from. */
  const goToContactSupport = useCallback(
    (reason: MigrationSupportReason) => {
      navigation.navigate("accountMigrationContactSupport", {
        reason,
        origin: MigrationSupportOrigin.Commit,
        custodialAccountId: custodialAccountId ?? undefined,
      })
    },
    [navigation, custodialAccountId],
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

  const [isCloseUnavailable, setIsCloseUnavailable] = useState(false)
  const [completionAttempt, setCompletionAttempt] = useState(0)

  /** Which completion attempt already went out, claimed before the call rather than after it
   *  answers, so neither an extra render nor an unstable identity fires a second one. */
  const firedAttemptRef = useRef(-1)

  /** A successful completion clears the checkpoint, so once one has run a missing
   *  provisioned account is the expected outcome, not the fault this screen watches for. */
  const hasAttemptedCompletion = firedAttemptRef.current >= 0
  const hasProvisionedAccount = Boolean(migrationAccountId)
  const isAccountMissing =
    !migrationLoading && !hasProvisionedAccount && !hasAttemptedCompletion

  const isTransferSkipped = migrationLoading || isAccountMissing
  const {
    isTransferred,
    isReceiveProven,
    isReceiveDelayed,
    failureReason,
    isClockOutOfSync,
    hasConnectionIssue,
    retry,
  } = useMigrationTransfer({
    custodialAccountId,
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

  /** Point of no return: reset so the finished transfer screen (whose work is done and which
   *  swallows back) is gone from the stack, not left mounted under success where a back press
   *  before success auto-navigates home would land on it. */
  const resetToSuccess = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: "selfCustodialBackupSuccess", params: { reBackup: false } }],
    })
  }, [navigation])

  /** Home sits underneath, never the success screen: success auto-navigates home a couple of
   *  seconds after its animation, from wherever it is mounted, and would take this handover
   *  with it. Back then leaves support for the funded wallet, which is where the user
   *  belongs once they have read the ticket. */
  const resetToCloseRefusedSupport = useCallback(() => {
    navigation.reset({
      index: 1,
      routes: [
        { name: "Primary" },
        {
          name: "accountMigrationContactSupport",
          params: {
            reason: MigrationSupportReason.CustodialAccountCloseRefused,
            origin: MigrationSupportOrigin.CloseRefused,
            custodialAccountId: custodialAccountId ?? undefined,
          },
        },
      ],
    })
  }, [navigation, custodialAccountId])

  /** The close is the only step bound to this moment, because the discard that follows
   *  destroys the token it needs; the swap after it is local, so a failure there leaves a
   *  completed migration the next launch can still finish. */
  useEffect(() => {
    if (!isTransferred) return

    /** Read and claimed inside the effect, not at render: a closure re-run without a render
     *  in between (React's development remount) would otherwise carry a stale "not fired
     *  yet" and send a second completion after the first. */
    if (firedAttemptRef.current === completionAttempt) return
    firedAttemptRef.current = completionAttempt

    completeMigration({ isReceiveProven })
      .then((completion) => {
        /** Exhaustive on purpose: the fallthrough of an if-chain here resets the stack to
         *  the success screen, so a new outcome would silently tell the user the migration
         *  finished. A type error is the cheaper way to find out. */
        switch (completion) {
          case MigrationCompletion.Completed:
            resetToSuccess()
            return

          case MigrationCompletion.AccountMissing:
            goToContactSupport(MigrationSupportReason.SelfCustodialAccountMissing)
            return

          case MigrationCompletion.CloseUnavailable:
            setIsCloseUnavailable(true)
            return

          case MigrationCompletion.CloseRefused:
            resetToCloseRefusedSupport()
            return

          default: {
            const unhandledCompletion: never = completion
            reportError(
              "Migration completion unhandled",
              new Error(`Unhandled completion: ${String(unhandledCompletion)}`),
            )
          }
        }
      })
      .catch((err) => {
        reportError("Migration session swap", err)
        /** The close settles into an outcome rather than throwing, so what lands here is
         *  a local step after the funds moved, not a transfer failure. */
        goToContactSupport(MigrationSupportReason.CompletionFailed)
      })
  }, [
    isTransferred,
    isReceiveProven,
    completionAttempt,
    completeMigration,
    resetToSuccess,
    resetToCloseRefusedSupport,
    goToContactSupport,
  ])

  /** Whichever step is unsettled is the one the press retries. */
  const retryRecoverable = useCallback(() => {
    if (isCloseUnavailable) {
      setIsCloseUnavailable(false)
      setCompletionAttempt((previous) => previous + 1)
      return
    }
    retry()
  }, [isCloseUnavailable, retry])

  /** A skewed clock, a lost connection and a close that never settled share the retry
   *  footer. The close runs last, so it owns the footer whenever more than one step is
   *  unsettled, and the retry above resolves in the same order: the button cannot name one
   *  step and press another. Only a real failure leaves this screen for support. */
  const isRecoverable = isClockOutOfSync || hasConnectionIssue || isCloseUnavailable
  const isClockRetry = isClockOutOfSync && !isCloseUnavailable

  /** The delayed notice yields to a recoverable issue: a lost connection explains the
   *  wait better than the wait itself, and its retry is the more useful footer. */
  const isDelayedNoticeShown = isReceiveDelayed && !isRecoverable

  const clockOrConnectionMessage = isClockRetry
    ? LLMigration.clockOutOfSync.body()
    : LL.errors.network.connection()
  const recoverableMessage = isCloseUnavailable
    ? LLMigration.closeUnavailable()
    : clockOrConnectionMessage
  const waitingMessage = isDelayedNoticeShown
    ? LLMigration.transferDelayed.body()
    : LLMigration.transferringFunds()
  const message = isRecoverable ? recoverableMessage : waitingMessage

  const retryTitle = isClockRetry
    ? LLMigration.clockOutOfSync.retryCta()
    : LL.common.tryAgain()
  const clockOrConnectionTestId = isClockRetry
    ? "migration-clock-out-of-sync-retry"
    : "migration-connection-issue-retry"
  const retryTestId = isCloseUnavailable
    ? "migration-close-unavailable-retry"
    : clockOrConnectionTestId

  const recoverableFooter = (
    <GaloyPrimaryButton
      title={retryTitle}
      onPress={retryRecoverable}
      {...testProps(retryTestId)}
    />
  )

  /** Secondary, not primary: waiting stays the recommended path — the completion still
   *  fires the moment the receive lands, including while the support screen sits on top
   *  (this screen stays mounted beneath it, exactly like the failure handover). */
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
    <Screen preset="fixed" headerShown={false}>
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
