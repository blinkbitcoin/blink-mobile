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
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"
import { WindDownStatus } from "@app/types/wind-down"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"
import { StorageFailure } from "@app/utils/storage/storage-failure"

import {
  useActiveApiKeys,
  useCustodialWalletBalances,
  useMigrationCheckpoint,
} from "@app/screens/account-migration/hooks"
import { useCustodialWindDown } from "@app/screens/account-migration/hooks/use-custodial-wind-down"
import { useMigrationLock } from "@app/screens/account-migration/hooks/use-migration-lock"
import { useReusablePendingWallet } from "@app/screens/account-migration/hooks/use-reusable-pending-wallet"
import { armMigrationConversion } from "@app/screens/conversion-flow/drain-conversion"
import { useSelfCustodialDisabled } from "@app/screens/account-migration/hooks/use-self-custodial-disabled"

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

/** How many failed retries stand in for "this is not going to clear on its own". Low
 *  enough that a trapped user is not left tapping, high enough that one bad read does not
 *  send a recoverable device to support. */
const MAX_RETRIES_BEFORE_STORAGE_HANDOVER = 3

/**
 * Entry gate for the migration flow, the single choke point for the Settings entry
 * (tapping Migrate), the armed gate that replaces the app after closure, and a migration
 * the server has locked. Order of checks: accounts with API keys see the API-service
 * warning first, then any custodial Dollar Balance blocks entry because the user has to
 * empty it manually, and finally the "Time to upgrade" screen in the mode the wind-down
 * phase demands (voluntary, forced pre-deadline, or the armed gate).
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

  const goToDollarTransfer = useCallback(() => {
    /** Arm the flag before navigating so the convert screen waives its region restriction
     *  for this migration step (see drain-conversion); the deep-linkable route is
     *  not trusted with that on its own. */
    armMigrationConversion()
    navigation.navigate("conversionDetails")
  }, [navigation])

  const hasResumeDataError = checkpointError || pendingWalletError

  /** Only this screen's storage branch may claim the device could not be read: the same
   *  screen also serves API-key, balance and lock failures, and a user who is offline as
   *  well would be sent looking at their phone for the network's problem. */
  const hasNetworkDataError = apiKeysError || balancesError || lockError
  const isStorageReadFailure =
    isMigrationLocked && hasResumeDataError && !hasNetworkDataError

  /** Retry must not fail silently: catch the rejection, and disable/spin the button while it
   *  is in flight so repeated taps cannot stack requests over an unchanged error screen. */
  const [isRetrying, setIsRetrying] = useState(false)
  /** Counted rather than diagnosed: the store's own message cannot say whether a failure
   *  will clear (Android answers an unopenable database with "Database Error" and nothing
   *  else), so repeated failure is the only honest evidence that retrying is not working,
   *  and the escape below is offered on that instead of on a guess. */
  const [failedRetryCount, setFailedRetryCount] = useState(0)
  const retryGateData = useCallback(async () => {
    setIsRetrying(true)
    /** Only this device's failures count. A retry made while the network is what failed
     *  says nothing about whether the store will ever answer, and carrying those attempts
     *  over would arm the handover on the first local read that fails. */
    if (isStorageReadFailure) setFailedRetryCount((previous) => previous + 1)
    try {
      await Promise.all([
        refetchApiKeys(),
        refetchBalances(),
        refetchLock(),
        refetchCheckpoint(),
        refetchPendingWallet(),
      ])
    } catch (err) {
      reportError("Migration gate retry", err)
    } finally {
      setIsRetrying(false)
    }
  }, [
    isStorageReadFailure,
    refetchApiKeys,
    refetchBalances,
    refetchLock,
    refetchCheckpoint,
    refetchPendingWallet,
  ])

  /** Returning from the dollar-transfer conversion, refetch so the balance reflects the
   *  now-empty dollars instead of the cached pre-transfer figure. */
  const hasBlurredRef = useRef(false)
  useEffect(() => {
    if (!isFocused) {
      hasBlurredRef.current = true
      return
    }
    if (!hasBlurredRef.current) return
    hasBlurredRef.current = false
    refetchBalances()
  }, [isFocused, refetchBalances])

  /** Ready only once every source has settled WITH data, so a failed query never reads as
   *  an empty answer; the lock is part of it, or the gate decides before it knows, renders
   *  the intro, and only then learns it should have resumed. */
  const isGateDataLoading = !apiKeysReady || !balancesReady || lockLoading

  /** A failed query read as its empty default would wave a user with API keys or a live
   *  dollar balance straight in, or re-pitch the intro to a user a failed lock read makes
   *  look unlocked, so a settled error blocks with a retry instead. The local reads join
   *  only when locked — that is the only decision they feed, and an unreadable store there
   *  would impersonate a wiped device and hand a resumable user to terminal support. */
  const hasGateDataError =
    apiKeysError ||
    balancesError ||
    lockError ||
    (isMigrationLocked && hasResumeDataError)

  /** Either read can be the one that failed. The answer the user can act on wins over the
   *  one that says nothing, rather than whichever source happened to answer first. */
  const isStorageOutOfSpace =
    checkpointStorageFailure === StorageFailure.OutOfSpace ||
    pendingWalletStorageFailure === StorageFailure.OutOfSpace

  /** Only the locked flow strands anyone: unlocked, this screen sits over an app the user
   *  can still walk away from, while locked it replaces it.
   *
   *  Held back while a retry is in flight: the count rises when one starts, so the last
   *  one may still be about to succeed, and this button — unlike the primary, which
   *  disables itself — would otherwise be tappable straight onto a screen with no way
   *  back. */
  const hasExhaustedStorageRetries =
    failedRetryCount >= MAX_RETRIES_BEFORE_STORAGE_HANDOVER
  const shouldOfferStorageHandover =
    isStorageReadFailure && hasExhaustedStorageRetries && !isRetrying

  /** The count belongs to one run of storage failures. A read that finally lands puts the
   *  user back in the flow, and a failure that turns out to be the network's is not
   *  evidence about this device, so neither may carry attempts into the next. */
  useEffect(() => {
    if (isStorageReadFailure) return
    setFailedRetryCount(0)
  }, [isStorageReadFailure])

  const goToStorageSupport = useCallback(() => {
    navigation.navigate("accountMigrationContactSupport", {
      reason: MigrationSupportReason.StorageUnreadable,
      origin: MigrationSupportOrigin.Gate,
    })
  }, [navigation])

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
   * A locked migration skips the intro and resumes where it left off. That screen exists
   * to convince someone who has not started; the server has already recorded this account
   * as migrating, so re-pitching it would be both wrong and an extra tap between the user
   * and finishing. The preconditions still run first: a dollar balance that arrived
   * mid-flow has to be emptied whatever the phase, or the commit is refused. The
   * self-custodial disable outranks even this, since a disabled stack shows unavailable,
   * never resumes.
   */
  const shouldResumeLockedMigration =
    isMigrationLocked &&
    !isSelfCustodialDisabled &&
    !isGateDataLoading &&
    !shouldWarnAboutApiKeys &&
    !shouldBlockOnDollarBalance

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
