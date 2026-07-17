import React, { useCallback, useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { DollarBalanceMigrationModal } from "@app/components/dollar-balance-migration-modal"
import { Screen } from "@app/components/screen"
import { useDollarBalanceRestricted } from "@app/hooks/use-dollar-balance-restricted"
import { useTransferBlocked } from "@app/hooks/use-transfer-blocked"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { WindDownStatus } from "@app/types/wind-down"
import { testProps } from "@app/utils/testProps"

import {
  useActiveApiKeys,
  useCustodialWalletBalances,
} from "@app/screens/account-migration/hooks"
import { useCustodialWindDown } from "@app/screens/account-migration/hooks/use-custodial-wind-down"

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
  const { hasActiveApiKeys, loading: apiKeysLoading } = useActiveApiKeys()
  const windDown = useCustodialWindDown()
  const mode = resolveMigrationMode(windDown?.status)
  const isGated = mode === "gate"
  const isTransferBlocked = useTransferBlocked()
  const isDollarBalanceRestricted = useDollarBalanceRestricted()
  const [isApiWarningAcknowledged, setIsApiWarningAcknowledged] = useState(false)

  /** While a pushed screen (the dollar transfer) has focus the modal hides instead of
   *  floating over it; regaining focus shows it again with a fresh balance check. */
  const isFocused = useIsFocused()

  const { usdBalanceCents, loading: walletsLoading } = useCustodialWalletBalances()

  const acknowledgeApiWarning = useCallback(() => setIsApiWarningAcknowledged(true), [])

  const exitFlow = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const goToDollarTransfer = useCallback(() => {
    navigation.navigate("conversionDetails")
  }, [navigation])

  /** In blocker mode the gate replaces the whole app, so returning null here would
   *  leave a blank screen on every launch until the queries resolve. */
  const isGateDataLoading = apiKeysLoading || walletsLoading
  if (isGateDataLoading) {
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
}))
