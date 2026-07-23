import React, { useCallback, useEffect, useRef } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { RichText } from "@app/components/rich-text"
import { Screen } from "@app/components/screen"
import { MigrationStatus } from "@app/graphql/generated"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { BalancePairCard } from "@app/screens/account-migration/balance-pair-card"
import {
  MigrationCheckpoint,
  useMigrationBalancesPreview,
  useMigrationCheckpoint,
  useHardwareBackGuard,
} from "@app/screens/account-migration/hooks"
import { useCustodialOwnerId } from "@app/screens/account-migration/hooks/use-custodial-owner-id"
import { useEnsureMigrationStarted } from "@app/screens/account-migration/hooks/use-ensure-migration-started"
import { useMigrationLnAddressTransfer } from "@app/screens/account-migration/hooks/use-migration-ln-address-transfer"
import { useMigrationStatus } from "@app/screens/account-migration/hooks/use-migration-status"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

/**
 * The migration commit screen: the current and resulting balances plus the network fee,
 * rendered from the preview model. Landing here (not Approve) is the point of no return: it
 * declares the migration started; Approve then commits the transfer on the next screen.
 */
export const MigrationBalancesOverviewScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const LLOverview = LL.AccountMigration.balancesOverview
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /** The commit screen must never present unknown balances as zeros: until the preview
   *  is ready, its area holds a spinner and Approve stays off. */
  const preview = useMigrationBalancesPreview()
  const { openSupport } = useContactSupport()
  const {
    accountId: selfCustodialAccountId,
    loading: checkpointLoading,
    saveCheckpoint,
  } = useMigrationCheckpoint()
  const isFocused = useIsFocused()

  /** The commit point has no return path: the gesture is disabled on the
   *  route, and the hardware back is swallowed here. */
  useHardwareBackGuard()

  /** A migration the server already reports as FAILED skips arming and the re-point and
   *  hands straight over to support. */
  const { status: migrationStatus } = useMigrationStatus()
  const isMigrationFailed = migrationStatus === MigrationStatus.Failed

  /**
   * Landing here WITH figures declares the migration started server-side, which is what
   * makes this the point of no return: the lock then lives on the backend and survives a
   * reinstall, where the checkpoint below only remembers which screen to resume on. It
   * waits for the figures because a screen that cannot show what is being migrated has no
   * business claiming the user consented to migrating it.
   */
  const migrationStart = useEnsureMigrationStarted({
    skip: !preview.isReady || isMigrationFailed,
  })

  const { ownerId } = useCustodialOwnerId()

  /** The re-point runs here, only once the start is confirmed so a rejected start never
   *  moves the address irreversibly. It needs the custodial session the completion swap
   *  discards, so this is the last place it can fire, and Approve waits on it. */
  const isLnRepointBlocked = !preview.isReady || !migrationStart.isStarted
  const lnAddressTransfer = useMigrationLnAddressTransfer({
    custodialAccountId: ownerId,
    selfCustodialAccountId,
    skip: isLnRepointBlocked,
  })

  /** The checkpoint only remembers which screen to resume on. Gated on focus so a
   *  background instance (this screen stays mounted under the completion screen) never
   *  re-saves the checkpoint the migration just cleared, and on ready figures so it is
   *  never recorded before the commit point exists. */
  useEffect(() => {
    if (!isFocused || checkpointLoading || !preview.isReady) return
    saveCheckpoint(MigrationCheckpoint.BalancesOverview)
  }, [isFocused, checkpointLoading, preview.isReady, saveCheckpoint])

  /**
   * The ways this screen ends without an Approve to offer, as one value: the preview
   * settled empty, the wallet query failed, the server refused to start, or the
   * lightning-address re-point failed. Each strands the user here where the hardware back
   * is swallowed, and each is as final as the others, so support takes over rather than
   * leaving an Approve that would commit into a flow the backend already declined. A
   * re-point still waiting on its account ids only keeps Approve off (never a false
   * handover on a transient skip); the always-present contact-support button is its escape.
   * Null means none of them.
   */
  const startFailureReason = migrationStart.isRejected
    ? MigrationSupportReason.StartRefused
    : null
  /** A missing device key is the same cause the commit reports; anything else is generic. */
  const lnAddressMissingReason = lnAddressTransfer.isAccountMissing
    ? MigrationSupportReason.SelfCustodialAccountMissing
    : null
  const lnAddressRejectedReason = lnAddressTransfer.isRejected
    ? MigrationSupportReason.LnAddressTransferFailed
    : null
  const lnAddressFailureReason = lnAddressMissingReason ?? lnAddressRejectedReason
  /** A migration already failed server-side leads the handover: nothing else on this screen
   *  matters once the phase is FAILED. */
  const failedReason = isMigrationFailed ? MigrationSupportReason.TransferFailed : null
  const handoverReason =
    failedReason ??
    startFailureReason ??
    lnAddressFailureReason ??
    preview.unavailableReason

  const hasReportedHandoverRef = useRef(false)

  /**
   * Reported once but routed on every focus. Backing out of the support screen returns
   * here, and a screen that has handed over has nothing left to offer: its Approve is
   * dead and its hardware back is swallowed, so landing on it would be a worse dead end
   * than the support screen the user just left. Telemetry stays at one report because the
   * failure is one event however many times the user bounces off it.
   */
  useFocusEffect(
    useCallback(() => {
      if (!handoverReason) return

      if (!hasReportedHandoverRef.current) {
        hasReportedHandoverRef.current = true
        reportError("Migration handed over to support", new Error(handoverReason))
      }

      navigation.navigate("accountMigrationContactSupport", {
        reason: handoverReason,
        origin: MigrationSupportOrigin.Commit,
      })
    }, [handoverReason, navigation]),
  )

  const handleApprove = useCallback(() => {
    navigation.navigate("accountMigrationTransferringFunds")
  }, [navigation])

  /** Either source losing the network earns the same retry, and it refreshes both:
   *  figures without a started migration are as useless as the reverse. */
  const isRetryable =
    preview.isRetryable ||
    migrationStart.hasConnectionIssue ||
    lnAddressTransfer.hasConnectionIssue

  const { retry: retryPreview } = preview
  const { retry: retryMigrationStart } = migrationStart
  const { retry: retryLnAddressTransfer } = lnAddressTransfer

  const handleRetry = useCallback(() => {
    retryPreview()
    retryMigrationStart()
    retryLnAddressTransfer()
  }, [retryPreview, retryMigrationStart, retryLnAddressTransfer])

  /** Approve commits against a server-side flow, so it stays off until the server has
   *  confirmed one exists and the lightning address has moved, not merely until the
   *  figures render. */
  const isApproveDisabled =
    !preview.isReady || !migrationStart.isStarted || !lnAddressTransfer.isTransferred

  return (
    <Screen preset="fixed" headerShown={false}>
      <View style={styles.container}>
        <IconHero
          icon="send"
          iconColor={colors.primary}
          title={LLOverview.title()}
          subtitle={LLOverview.body()}
        />

        {preview.isReady ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <BalancePairCard
              bitcoinLabel={LLOverview.currentBitcoinBalance()}
              bitcoinValue={preview.currentBitcoinBalance}
              bitcoinFiat={preview.currentBitcoinFiat}
              dollarLabel={LLOverview.currentDollarBalance()}
              dollarValue={preview.currentDollarBalance}
              isDollarValueMuted={preview.isCurrentDollarBalanceRestricted}
            />

            <RichText text={preview.networkFeeLine} style={styles.networkFee} />

            <View style={styles.arrowCircle}>
              <GaloyIcon name="arrow-down" size={24} color={colors.grey3} />
            </View>

            <BalancePairCard
              bitcoinLabel={LLOverview.newBitcoinBalance()}
              bitcoinValue={preview.newBitcoinBalance}
              bitcoinFiat={preview.newBitcoinFiat}
              dollarLabel={LLOverview.newDollarBalance()}
              dollarValue={preview.newDollarBalance}
              isDollarValueMuted={preview.isNewDollarBalanceRestricted}
            />

            {preview.exchangeRate ? (
              <View style={styles.exchangeRateBox}>
                <Text style={styles.exchangeRateText}>
                  {LLOverview.exchangeRate({ rate: preview.exchangeRate })}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.loadingContainer}>
            {isRetryable ? null : (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                {...testProps("migration-balances-overview-loading")}
              />
            )}
          </View>
        )}

        <View style={styles.buttonsContainer}>
          {/** Sits with the buttons, not in the figures' place: the start can fail over a
           *   preview that loaded, leaving a retry under visible balances with no reason. */}
          {isRetryable ? (
            <Text style={styles.connectionIssue}>{LL.errors.network.connection()}</Text>
          ) : null}

          {isRetryable ? (
            <GaloyPrimaryButton
              title={LLOverview.retryCta()}
              onPress={handleRetry}
              {...testProps("migration-balances-overview-retry")}
            />
          ) : (
            <GaloyPrimaryButton
              title={LLOverview.approveCta()}
              onPress={handleApprove}
              disabled={isApproveDisabled}
              {...testProps("migration-balances-overview-approve")}
            />
          )}
          <GaloySecondaryButton
            title={LLOverview.contactSupportCta()}
            onPress={openSupport}
            {...testProps("migration-balances-overview-contact-support")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionIssue: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.error,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  body: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: "center",
  },
  networkFee: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    textAlign: "center",
  },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey4,
    alignItems: "center",
    justifyContent: "center",
  },
  exchangeRateBox: {
    width: "100%",
    backgroundColor: colors.grey5,
    borderLeftWidth: 2,
    borderLeftColor: colors.black,
    borderRadius: 6,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
  },
  exchangeRateText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.black,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
