import React, { useCallback, useEffect, useRef, useState } from "react"
import { Text } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
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
  const { migrationAccountId, custodialAccountId, migrationLoading, completeMigration } =
    useCompleteMigration()

  /** No navigation at all while the funds move. */
  useHardwareBackGuard()

  /** The id travels with every handover, including the ones raised after the session was
   *  discarded, where the support screen has nothing left to query it from. */
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
  const { isTransferred, failureReason, isClockOutOfSync, hasConnectionIssue, retry } =
    useMigrationTransfer({
      custodialAccountId,
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
            origin: MigrationSupportOrigin.Resume,
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

    completeMigration()
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
        goToContactSupport(MigrationSupportReason.TransferFailed)
      })
  }, [
    isTransferred,
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

  const clockOrConnectionMessage = isClockRetry
    ? LLMigration.clockOutOfSync.body()
    : LL.errors.network.connection()
  const recoverableMessage = isCloseUnavailable
    ? LLMigration.closeUnavailable()
    : clockOrConnectionMessage
  const message = isRecoverable ? recoverableMessage : LLMigration.transferringFunds()

  const retryTitle = isClockRetry
    ? LLMigration.clockOutOfSync.retryCta()
    : LL.common.tryAgain()
  const clockOrConnectionTestId = isClockRetry
    ? "migration-clock-out-of-sync-retry"
    : "migration-connection-issue-retry"
  const retryTestId = isCloseUnavailable
    ? "migration-close-unavailable-retry"
    : clockOrConnectionTestId

  const retryFooter = isRecoverable ? (
    <GaloyPrimaryButton
      title={retryTitle}
      onPress={retryRecoverable}
      {...testProps(retryTestId)}
    />
  ) : undefined

  return (
    <Screen preset="fixed">
      <StatusScreenLayout
        icon="clock"
        iconColor={colors.warning}
        iconBackgroundColor={colors._warningLight}
        footer={retryFooter}
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
