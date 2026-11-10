import React, { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { DollarBalanceMigrationModal } from "@app/components/dollar-balance-migration-modal"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TemporarilyUnavailableScreen } from "@app/screens/feature-unavailable/temporarily-unavailable-screen"
import {
  MigrationSupportOrigin,
  MigrationSupportReason,
  PendingDepositCheckStatus,
} from "@app/types/migration"
import { WindDownStatus } from "@app/types/wind-down"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"
import { StorageFailure } from "@app/utils/storage/storage-failure"

import {
  useActiveApiKeys,
  useCustodialWalletBalances,
  useMigrationCheckpoint,
} from "@app/screens/account-migration/hooks"
import { useCustodialPendingDeposits } from "@app/screens/account-migration/hooks/use-custodial-pending-deposits"
import { useCustodialWindDown } from "@app/screens/account-migration/hooks/use-custodial-wind-down"
import { useMigrationSupportEmail } from "@app/screens/account-migration/hooks/use-migration-support-email"
import { useMigrationLock } from "@app/screens/account-migration/hooks/use-migration-lock"
import { useReusablePendingWallet } from "@app/screens/account-migration/hooks/use-reusable-pending-wallet"
import { useStorageHandover } from "@app/screens/account-migration/hooks/use-storage-handover"
import { armMigrationConversion } from "@app/screens/conversion-flow/drain-conversion"
import { useSelfCustodialDisabled } from "@app/screens/account-migration/hooks/use-self-custodial-disabled"
import { PendingDepositModal } from "@app/screens/account-migration/pending-deposit-modal"

import { MigrationApiServiceScreen } from "./api-service-screen"
import { MigrationMode, MigrationRequiredScreen } from "./migration-required-screen"

/**
 * The intro mode is the server wind-down phase, never a local guess: the closed account is
 * the gate, an affected account still before closure is forced, and an unaffected account
 * (only ever reached from Settings) is voluntary.
 */
const resolveMigrationMode = (status: WindDownStatus | undefined): MigrationMode => {
  if (status === WindDownStatus.GatedClosed) return "gate"
  const isPreClosurePhase =
    status === WindDownStatus.PreCutoff || status === WindDownStatus.ReceiveDisabled
  if (isPreClosurePhase) return "forcedPreDeadline"
  return "voluntary"
}

/**
 * Entry gate for the migration flow, the single choke point for the Settings entry
 * (tapping Migrate), the armed gate that replaces the app after closure, and a migration
 * the server has locked. Order of checks: accounts with API keys see the API-service
 * warning first, then any custodial Dollar Balance blocks entry because the user has to
 * empty it manually, then an on-chain deposit still confirming blocks it until it lands,
 * and finally the "Time to upgrade" screen in the mode the wind-down phase demands
 * (voluntary, forced pre-deadline, or the armed gate).
 */
export const MigrationGate: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const isSelfCustodialDisabled = useSelfCustodialDisabled()
  const {
    hasActiveApiKeys,
    isReady: apiKeysReady,
    hasError: apiKeysError,
    refetch: refetchApiKeys,
  } = useActiveApiKeys()
  const windDown = useCustodialWindDown()
  const mode = resolveMigrationMode(windDown?.status)
  const isGated = mode === "gate"

  /** A locked migration removes the way out just as the armed gate does: the server
   *  already recorded this account as migrating and the transfer will claim its balance. */
  const {
    isLocked: isMigrationLocked,
    isCommitted: isMigrationCommitted,
    loading: lockLoading,
    hasError: lockError,
    refetch: refetchLock,
  } = useMigrationLock()
  const isExitBlocked = isGated || isMigrationLocked
  const [isApiWarningAcknowledged, setIsApiWarningAcknowledged] = useState(false)

  /** While a pushed screen (the dollar transfer) has focus the modal hides instead of
   *  floating over it; regaining focus shows it again with a fresh balance check. */
  const isFocused = useIsFocused()

  const {
    usdBalanceCents,
    isReady: balancesReady,
    hasError: balancesError,
    refetch: refetchBalances,
  } = useCustodialWalletBalances()
  const {
    hasPendingDeposit,
    isReady: pendingDepositsReady,
    hasError: pendingDepositsError,
    check: checkPendingDeposits,
    recheck: recheckPendingDeposits,
    isRecheckRunning: isPendingDepositRecheckRunning,
    isStillPending: isPendingDepositStillPending,
  } = useCustodialPendingDeposits()
  const {
    navigateToCheckpoint,
    loading: checkpointLoading,
    hasError: checkpointError,
    refetch: refetchCheckpoint,
    hasResumableCheckpoint,
    storageFailure: checkpointStorageFailure,
  } = useMigrationCheckpoint()
  const {
    reusablePendingAccountId,
    loading: pendingWalletLoading,
    hasError: pendingWalletError,
    storageFailure: pendingWalletStorageFailure,
    refetch: refetchPendingWallet,
  } = useReusablePendingWallet()

  const acknowledgeApiWarning = useCallback(() => setIsApiWarningAcknowledged(true), [])

  const exitFlow = useCallback(() => {
    navigation.goBack()
  }, [navigation])
  /** The deposit modal's support mail carries the reason and the account, as every other
   *  migration handover does, so support can act on the first message. */
  const { sendSupportEmail: sendDepositSupportEmail } = useMigrationSupportEmail(
    MigrationSupportReason.DepositPending,
  )

  /** The retry reports the first source that failed, so a check that could not answer
   *  counts as one, carrying the error its request raised. A failed check also shows
   *  through the hook's own error, which is what sends the gate to its retry screen. */
  const checkPendingDepositsForRetry = useCallback(async (): Promise<void> => {
    const result = await checkPendingDeposits()
    const isFailedRequest =
      result.status === PendingDepositCheckStatus.Unknown && result.error !== null
    if (isFailedRequest) throw result.error
  }, [checkPendingDeposits])

  const goToDollarTransfer = useCallback(() => {
    /** Arm the flag before navigating so the convert screen waives its region restriction
     *  for this migration step (see drain-conversion); the deep-linkable route is
     *  not trusted with that on its own. */
    armMigrationConversion()
    navigation.navigate("conversionDetails")
  }, [navigation])

  /**
   * The pending wallet is the fallback for a checkpoint that is gone, so its read only
   * matters once the checkpoint has answered without one. A resumable checkpoint routes on
   * its own (and ensureAccount reuses its id before looking at the pending record), so a
   * failed pending read under it must not hold the user on a retry, or hand them to support
   * after three, over an answer that changes nothing. While the checkpoint is still loading
   * the gate shows its spinner rather than an error that may not apply.
   */
  const isPendingWalletNeeded = !checkpointLoading && !hasResumableCheckpoint
  const hasBlockingPendingWalletError = pendingWalletError && isPendingWalletNeeded
  const hasResumeDataError = checkpointError || hasBlockingPendingWalletError

  /** The deposit check only matters before the commit (see shouldBlockOnPendingDeposit), so
   *  a committed migration neither waits on it nor fails with it on its way to resume. */
  const isPendingDepositCheckNeeded = !isMigrationCommitted
  const hasPendingDepositsBlockingError =
    pendingDepositsError && isPendingDepositCheckNeeded
  const isPendingDepositsBlockingLoad =
    !pendingDepositsReady && isPendingDepositCheckNeeded

  /** Named for what it tests, not for one of its causes: any of the server-backed reads
   *  failing, GraphQL and auth errors included. It drives a user-facing decision —
   *  don't blame the device — so a reader must not widen it on the strength of the name. */
  const hasServerDataError =
    apiKeysError || balancesError || hasPendingDepositsBlockingError || lockError

  /** Settles only once every source has: the server refetches reject on a network
   *  error, and failing fast on one would end the retry while the local reads it exists to
   *  measure are still running. The first rejection is rethrown afterwards for the retry's
   *  report. A committed migration skips the deposit check, which it ignores anyway, so
   *  that check failing cannot fail its retry. */
  const refetchGateData = useCallback(async (): Promise<void> => {
    const results = await Promise.allSettled([
      refetchApiKeys(),
      refetchBalances(),
      isPendingDepositCheckNeeded ? checkPendingDepositsForRetry() : undefined,
      refetchLock(),
      refetchCheckpoint(),
      refetchPendingWallet(),
    ])
    const rejection = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    if (rejection) throw rejection.reason
  }, [
    refetchApiKeys,
    refetchBalances,
    isPendingDepositCheckNeeded,
    checkPendingDepositsForRetry,
    refetchLock,
    refetchCheckpoint,
    refetchPendingWallet,
  ])

  const {
    isStorageReadFailure,
    isRetrying,
    retry: retryGateData,
    shouldOfferHandover: shouldOfferStorageHandover,
  } = useStorageHandover({
    isMigrationLocked,
    hasResumeDataError,
    hasServerDataError,
    refetchGateData,
  })

  /** Returning from the dollar-transfer conversion, refetch so the balance reflects the
   *  now-empty dollars instead of the cached pre-transfer figure, and check the deposits
   *  again since one may have been sent while the conversion ran. */
  const hasBlurredRef = useRef(false)
  useEffect(() => {
    if (!isFocused) {
      hasBlurredRef.current = true
      return
    }
    if (!hasBlurredRef.current) return
    hasBlurredRef.current = false
    refetchBalances()
    checkPendingDeposits()
  }, [isFocused, refetchBalances, checkPendingDeposits])

  /** Ready only once every source has settled WITH data, so a failed query never reads as
   *  an empty answer; the lock is part of it, or the gate decides before it knows, renders
   *  the intro, and only then learns it should have resumed. */
  const isGateDataLoading =
    !apiKeysReady || !balancesReady || isPendingDepositsBlockingLoad || lockLoading

  /** A failed query read as its empty default would wave a user with API keys or a live
   *  dollar balance straight in, or re-pitch the intro to a user a failed lock read makes
   *  look unlocked, so a settled error blocks with a retry instead. The local reads join
   *  only when locked — that is the only decision they feed, and an unreadable store there
   *  would impersonate a wiped device and hand a resumable user to terminal support. */
  const hasGateDataError = hasServerDataError || (isMigrationLocked && hasResumeDataError)

  /** Either read can be the one that failed. The answer the user can act on wins over the
   *  one that says nothing, rather than whichever source happened to answer first. */
  const isStorageOutOfSpace =
    checkpointStorageFailure === StorageFailure.OutOfSpace ||
    pendingWalletStorageFailure === StorageFailure.OutOfSpace

  /** The ticket carries the same diagnosis the screen gave: a user told to free up space
   *  must not reach support under a code claiming the store could not be read. */
  const goToStorageSupport = useCallback(() => {
    const reason = isStorageOutOfSpace
      ? MigrationSupportReason.StorageOutOfSpace
      : MigrationSupportReason.StorageUnreadable
    navigation.navigate("accountMigrationContactSupport", {
      reason,
      origin: MigrationSupportOrigin.GateStorage,
    })
  }, [isStorageOutOfSpace, navigation])

  /** The API-key warning outranks the Dollar-Balance precondition in the entry order
   *  (entry, API-key check, Dollar Balance check, intro). */
  const shouldWarnAboutApiKeys = hasActiveApiKeys && !isApiWarningAcknowledged

  /**
   * Every phase blocks on a Dollar Balance, the armed gate included. The backend rejects
   * `migrationStart` and `migrationCommit` outright while the USD wallet holds anything
   * and it never converts on the user's behalf, so letting a gated account through would
   * only move the refusal to a screen with no way back. The user empties it manually.
   */
  const shouldBlockOnDollarBalance = usdBalanceCents > 0

  /**
   * Every phase blocks on an on-chain deposit that has not confirmed yet, until the
   * transfer is committed. Migrating moves the balance to a new on-chain address, so a
   * deposit that confirms afterwards lands on a drained custodial account with nothing to
   * credit it to, and support has to recover it by hand. Once committed the balance has
   * already left, so blocking would only keep the user from finishing. It comes after the
   * Dollar Balance, which the user can act on right away.
   */
  const shouldBlockOnPendingDeposit = hasPendingDeposit && !isMigrationCommitted

  /**
   * A locked migration skips the intro and resumes where it left off. That screen exists
   * to convince someone who has not started; the server has already recorded this account
   * as migrating, so re-pitching it would be both wrong and an extra tap between the user
   * and finishing. The preconditions still run first: a dollar balance that arrived
   * mid-flow has to be emptied whatever the phase, or the commit is refused, and a deposit
   * that arrived mid-flow has to confirm before the commit. The self-custodial disable
   * outranks even this, since a disabled stack shows unavailable, never resumes.
   */
  const shouldResumeLockedMigration =
    isMigrationLocked &&
    !isSelfCustodialDisabled &&
    !isGateDataLoading &&
    !shouldWarnAboutApiKeys &&
    !shouldBlockOnDollarBalance &&
    !shouldBlockOnPendingDeposit

  const hasResumedRef = useRef(false)

  useEffect(() => {
    /** The error guard runs here, not only in render: the retry screen committing does
     *  not stop this effect, and a read failure read as "nothing on device" would claim
     *  the once-per-mount ref and navigate a resumable user to terminal support over it.
     *  Unclaimed, a retry that succeeds re-runs this with real data. */
    if (
      !shouldResumeLockedMigration ||
      checkpointLoading ||
      pendingWalletLoading ||
      hasResumeDataError ||
      hasResumedRef.current
    )
      return

    /** Claimed once per mount: the checkpoint moves as the user advances, and a second
     *  run would yank them back from wherever they got to. */
    hasResumedRef.current = true

    /** A locked account with nothing to resume and no wallet to reuse would restart at the
     *  explainer and provision a fresh orphan every crash-reinstall cycle (#4070). No
     *  client mutation can release the server-side lock, so support is the only way
     *  forward; each cold start replays this handover until the lock is cleared. */
    if (!hasResumableCheckpoint && !reusablePendingAccountId) {
      reportError(
        "Migration locked without resumable checkpoint",
        new Error("Server lock present but no checkpoint or pending wallet on device"),
        { dedupKey: "migration-locked-without-checkpoint", alwaysRecord: true },
      )
      navigation.navigate("accountMigrationContactSupport", {
        reason: MigrationSupportReason.LockedWithoutCheckpoint,
        origin: MigrationSupportOrigin.Gate,
      })
      return
    }
    navigateToCheckpoint()
  }, [
    shouldResumeLockedMigration,
    checkpointLoading,
    pendingWalletLoading,
    hasResumeDataError,
    hasResumableCheckpoint,
    reusablePendingAccountId,
    navigateToCheckpoint,
    navigation,
  ])

  /** The emergency-disable net. Every entry funnels through the gate, so blocking here
   *  pauses the whole flow the moment ops disables the stack, whatever path the user
   *  arrived by. */
  if (isSelfCustodialDisabled) {
    return <TemporarilyUnavailableScreen />
  }

  if (hasGateDataError) {
    /** Says what actually failed, and only inside this branch: the generic wording stays
     *  for the failures that are the network's, since telling those users their device
     *  could not be read would send them looking in the wrong place. */
    const storageErrorBody = isStorageOutOfSpace
      ? LL.AccountMigration.storageUnavailable.outOfSpaceBody()
      : LL.AccountMigration.storageUnavailable.unreadableBody()
    const gateErrorBody = isStorageReadFailure ? storageErrorBody : LL.errors.generic()

    return (
      <Screen preset="fixed" headerShown={false}>
        <View style={styles.errorContainer}>
          <View style={styles.messageContainer}>
            <GaloyIcon name="warning" size={64} color={colors.warning} />
            <Text type="p1" style={styles.messageText}>
              {gateErrorBody}
            </Text>
          </View>

          <View style={styles.buttonsContainer}>
            <GaloyPrimaryButton
              title={LL.common.tryAgain()}
              onPress={retryGateData}
              loading={isRetrying}
              disabled={isRetrying}
              {...testProps("migration-gate-retry")}
            />
            {shouldOfferStorageHandover ? (
              <GaloySecondaryButton
                title={LL.AccountMigration.storageUnavailable.contactSupportCta()}
                onPress={goToStorageSupport}
                {...testProps("migration-gate-storage-support")}
              />
            ) : null}
          </View>
        </View>
      </Screen>
    )
  }

  /** In blocker mode the gate replaces the whole app, so returning null here would
   *  leave a blank screen on every launch until the queries settle WITH data, and a locked
   *  migration would flash the intro it is about to navigate away from. */
  if (isGateDataLoading || shouldResumeLockedMigration) {
    return (
      <Screen preset="fixed" headerShown={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
            {...testProps("migration-gate-loading")}
          />
        </View>
      </Screen>
    )
  }

  if (shouldWarnAboutApiKeys) {
    /** Same close rules as the "Time to upgrade" screen: closable until the way out is
     *  blocked by the armed gate or by a locked migration. */
    const apiCloseAction = isExitBlocked ? undefined : exitFlow
    return (
      <MigrationApiServiceScreen
        onContinue={acknowledgeApiWarning}
        onClose={apiCloseAction}
      />
    )
  }

  if (shouldBlockOnDollarBalance) {
    /** Every affected user converts in-app from here, restricted regions included: the
     *  convert screen waives its usual region bounce when it is reached as a migration step
     *  (confirmed by the server wind-down, not the deep-linkable param alone), so the modal
     *  always offers the conversion. The close icon is hidden where the exit is blocked (the
     *  armed gate or a locked migration): no way back, so Transfer is the only action. */
    const canCloseDollarModal = !isExitBlocked
    return (
      <>
        <MigrationRequiredScreen mode={mode} isExitBlocked={isExitBlocked} />
        <DollarBalanceMigrationModal
          isVisible={isFocused}
          toggleModal={exitFlow}
          onTransfer={goToDollarTransfer}
          showCloseIconButton={canCloseDollarModal}
        />
      </>
    )
  }

  if (shouldBlockOnPendingDeposit) {
    /** Leaving is the way to wait, and coming back from Settings asks the network again.
     *  Where the exit is blocked (the armed gate or a locked migration) OK checks again
     *  instead, so a deposit that has confirmed lets the user through right here. */
    const acknowledgePendingDeposit = isExitBlocked ? recheckPendingDeposits : exitFlow
    const canClosePendingDepositModal = !isExitBlocked
    const pendingDepositSupportAction = isExitBlocked
      ? sendDepositSupportEmail
      : undefined
    /** Both only where OK checks again: where it leaves, a check running in the
     *  background has nothing to do with it, and there is nothing to try again. */
    const isPendingDepositCheckShown = isExitBlocked && isPendingDepositRecheckRunning
    const isStillPendingShown = isExitBlocked && isPendingDepositStillPending
    return (
      <>
        <MigrationRequiredScreen mode={mode} isExitBlocked={isExitBlocked} />
        <PendingDepositModal
          isVisible={isFocused}
          onAcknowledge={acknowledgePendingDeposit}
          showCloseIconButton={canClosePendingDepositModal}
          isChecking={isPendingDepositCheckShown}
          onContactSupport={pendingDepositSupportAction}
          isStillPending={isStillPendingShown}
        />
      </>
    )
  }

  return <MigrationRequiredScreen mode={mode} isExitBlocked={isExitBlocked} />
}

const useStyles = makeStyles(() => ({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
  },
  messageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  /** The flow's button block: same metrics as every other migration screen, so the
   *  actions sit where the user has been finding them all the way here. */
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  messageText: {
    textAlign: "center",
  },
}))
