import React, { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { DollarBalanceMigrationModal } from "@app/components/dollar-balance-migration-modal"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TemporarilyUnavailableScreen } from "@app/screens/feature-unavailable/temporarily-unavailable-screen"
import { WindDownStatus } from "@app/types/wind-down"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

import {
  useActiveApiKeys,
  useCustodialWalletBalances,
  useMigrationCheckpoint,
} from "@app/screens/account-migration/hooks"
import { useCustodialWindDown } from "@app/screens/account-migration/hooks/use-custodial-wind-down"
import { useMigrationLock } from "@app/screens/account-migration/hooks/use-migration-lock"
import { armMigrationConversion } from "@app/screens/account-migration/hooks/use-migration-conversion"
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
  const { navigateToCheckpoint, loading: checkpointLoading } = useMigrationCheckpoint()

  const acknowledgeApiWarning = useCallback(() => setIsApiWarningAcknowledged(true), [])

  const exitFlow = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const goToDollarTransfer = useCallback(() => {
    /** Arm the flag before navigating so the convert screen waives its region restriction
     *  for this migration step (see use-migration-conversion); the deep-linkable route is
     *  not trusted with that on its own. */
    armMigrationConversion()
    navigation.navigate("conversionDetails")
  }, [navigation])

  /** Retry must not fail silently: catch the rejection, and disable/spin the button while it
   *  is in flight so repeated taps cannot stack requests over an unchanged error screen. */
  const [isRetrying, setIsRetrying] = useState(false)
  const retryGateData = useCallback(async () => {
    setIsRetrying(true)
    try {
      await Promise.all([refetchApiKeys(), refetchBalances(), refetchLock()])
    } catch (err) {
      reportError("Migration gate retry", err)
    } finally {
      setIsRetrying(false)
    }
  }, [refetchApiKeys, refetchBalances, refetchLock])

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
   *  look unlocked, so a settled error blocks with a retry instead. */
  const hasGateDataError = apiKeysError || balancesError || lockError

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
    if (!shouldResumeLockedMigration || checkpointLoading || hasResumedRef.current) return

    /** Claimed once per mount: the checkpoint moves as the user advances, and a second
     *  run would yank them back from wherever they got to. */
    hasResumedRef.current = true
    navigateToCheckpoint()
  }, [shouldResumeLockedMigration, checkpointLoading, navigateToCheckpoint])

  /** The emergency-disable net. Every entry funnels through the gate, so blocking here
   *  pauses the whole flow the moment ops disables the stack, whatever path the user
   *  arrived by. */
  if (isSelfCustodialDisabled) {
    return <TemporarilyUnavailableScreen />
  }

  if (hasGateDataError) {
    return (
      <Screen preset="fixed">
        <View style={styles.messageContainer}>
          <GaloyIcon name="warning" size={64} color={colors.warning} />
          <Text type="p1" style={styles.messageText}>
            {LL.errors.generic()}
          </Text>
          <GaloyPrimaryButton
            title={LL.common.tryAgain()}
            onPress={retryGateData}
            loading={isRetrying}
            disabled={isRetrying}
            {...testProps("migration-gate-retry")}
          />
        </View>
      </Screen>
    )
  }

  /** In blocker mode the gate replaces the whole app, so returning null here would
   *  leave a blank screen on every launch until the queries settle WITH data, and a locked
   *  migration would flash the intro it is about to navigate away from. */
  if (isGateDataLoading || shouldResumeLockedMigration) {
    return (
      <Screen preset="fixed">
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
     *  always offers the conversion instead of a dead-end Close. */
    return (
      <>
        <MigrationRequiredScreen mode={mode} isExitBlocked={isExitBlocked} />
        <DollarBalanceMigrationModal
          isVisible={isFocused}
          toggleModal={exitFlow}
          onTransfer={goToDollarTransfer}
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
  messageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  messageText: {
    textAlign: "center",
  },
}))
