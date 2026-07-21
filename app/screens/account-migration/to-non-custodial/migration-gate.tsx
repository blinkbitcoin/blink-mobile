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
import { useDollarBalanceRestricted } from "@app/hooks/use-dollar-balance-restricted"
import { useTransferBlocked } from "@app/hooks/use-transfer-blocked"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TemporarilyUnavailableScreen } from "@app/screens/feature-unavailable/temporarily-unavailable-screen"
import { WindDownStatus } from "@app/types/wind-down"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

import {
  useActiveApiKeys,
  useCustodialWalletBalances,
} from "@app/screens/account-migration/hooks"
import { useCustodialWindDown } from "@app/screens/account-migration/hooks/use-custodial-wind-down"
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
 * Entry gate for the migration flow, the single choke point for both the Settings entry
 * (tapping Migrate) and the armed gate that replaces the app after closure. Order of
 * checks: accounts with API keys see the API-service warning first, then a custodial
 * Dollar Balance blocks entry (the user empties it manually; post-gate this does not apply
 * since the flow itself converts dollars), and finally the "Time to upgrade" screen in the
 * mode the wind-down phase demands (voluntary, forced pre-deadline, or the armed gate).
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
  const isTransferBlocked = useTransferBlocked()
  const isDollarBalanceRestricted = useDollarBalanceRestricted()
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

  const acknowledgeApiWarning = useCallback(() => setIsApiWarningAcknowledged(true), [])

  const exitFlow = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const goToDollarTransfer = useCallback(() => {
    navigation.navigate("conversionDetails")
  }, [navigation])

  /** Retry must not fail silently: catch the rejection, and disable/spin the button while it
   *  is in flight so repeated taps cannot stack requests over an unchanged error screen. */
  const [isRetrying, setIsRetrying] = useState(false)
  const retryGateData = useCallback(async () => {
    setIsRetrying(true)
    try {
      await Promise.all([refetchApiKeys(), refetchBalances()])
    } catch (err) {
      reportError("Migration gate retry", err)
    } finally {
      setIsRetrying(false)
    }
  }, [refetchApiKeys, refetchBalances])

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

  /** The kill-switch net. Every entry funnels through the gate, so blocking here pauses the
   *  whole flow the moment ops disables the stack, whatever path the user arrived by. */
  if (isSelfCustodialDisabled) {
    return <TemporarilyUnavailableScreen />
  }

  /** A safety check reading a failed query as its empty default would wave a user with
   *  API keys or a live dollar balance straight in. Block on error and offer a retry. */
  const hasGateDataError = apiKeysError || balancesError
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
   *  leave a blank screen on every launch until the queries settle WITH data. */
  const isGateDataReady = apiKeysReady && balancesReady
  if (!isGateDataReady) {
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

  const hasCustodialDollarBalance = usdBalanceCents > 0

  /** The API-key warning outranks the Dollar-Balance precondition in the entry order
   *  (entry, API-key check, Dollar Balance check, intro). */
  const shouldWarnAboutApiKeys = hasActiveApiKeys && !isApiWarningAcknowledged
  if (shouldWarnAboutApiKeys) {
    /** Same close rules as the "Time to upgrade" screen: closable until the gate arms. */
    const apiCloseAction = isGated ? undefined : exitFlow
    return (
      <MigrationApiServiceScreen
        onContinue={acknowledgeApiWarning}
        onClose={apiCloseAction}
      />
    )
  }

  /** Post-gate the user enters WITH dollars and the flow converts them at the final
   *  step, so the empty-your-dollars precondition only guards the pre-deadline paths.
   *  TODO: the backend re-enforces this precondition on migrationStart; this modal is
   *  the UX half of the check. */
  const shouldBlockOnDollarBalance = hasCustodialDollarBalance && !isGated
  if (shouldBlockOnDollarBalance) {
    /** The conversion screen bounces blocked or dollar-restricted regions back home, so
     *  the Transfer variant only shows when the user can actually reach it; restricted
     *  regions empty their dollars through the home's forced convert modal instead. */
    const canTransferInApp = !isTransferBlocked && !isDollarBalanceRestricted
    const transferAction = canTransferInApp ? goToDollarTransfer : undefined
    return (
      <>
        <MigrationRequiredScreen mode={mode} />
        <DollarBalanceMigrationModal
          isVisible={isFocused}
          toggleModal={exitFlow}
          onTransfer={transferAction}
        />
      </>
    )
  }

  return <MigrationRequiredScreen mode={mode} />
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
