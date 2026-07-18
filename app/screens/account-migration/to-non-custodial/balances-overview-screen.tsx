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
import { useEnsureMigrationStarted } from "@app/screens/account-migration/hooks/use-ensure-migration-started"
import { MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

/**
 * The migration commit screen: the current and resulting balances plus the network fee,
 * rendered from the preview model, with Approve as the point of no return.
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
  const { loading: checkpointLoading, saveCheckpoint } = useMigrationCheckpoint()
  const isFocused = useIsFocused()

  /** The commit point has no return path: the gesture is disabled on the
   *  route, and the hardware back is swallowed here. */
  useHardwareBackGuard()

  /**
   * Landing here WITH figures declares the migration started server-side, which is what
   * makes this the point of no return: the lock then lives on the backend and survives a
   * reinstall, where the checkpoint below only remembers which screen to resume on. It
   * waits for the figures because a screen that cannot show what is being migrated has no
   * business claiming the user consented to migrating it.
   */
  const migrationStart = useEnsureMigrationStarted({ skip: !preview.isReady })

  /** The checkpoint only remembers which screen to resume on. Gated on focus so a
   *  background instance (this screen stays mounted under the completion screen) never
   *  re-saves the checkpoint the migration just cleared, and on ready figures so it is
   *  never recorded before the commit point exists. */
  useEffect(() => {
    if (!isFocused || checkpointLoading || !preview.isReady) return
    saveCheckpoint(MigrationCheckpoint.BalancesOverview)
  }, [isFocused, checkpointLoading, preview.isReady, saveCheckpoint])

  /**
   * The three ways this screen ends without figures to approve, as one value: the preview
   * settled empty, the wallet query failed, or the server refused to start. All three
   * strand the user here where the hardware back is swallowed, and a refusal is as final
   * as the other two, so support takes over rather than leaving an Approve that would
   * commit into a flow the backend already declined to open. Null means none of them.
   */
  const handoverReason = migrationStart.isRejected
    ? MigrationSupportReason.StartRefused
    : preview.unavailableReason

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

      navigation.navigate("accountMigrationContactSupport", { reason: handoverReason })
    }, [handoverReason, navigation]),
  )

  const handleApprove = useCallback(() => {
    navigation.navigate("accountMigrationTransferringFunds")
  }, [navigation])

  /** Either source losing the network earns the same retry, and it refreshes both:
   *  figures without a started migration are as useless as the reverse. */
  const isRetryable = preview.isRetryable || migrationStart.hasConnectionIssue

  const { retry: retryPreview } = preview
  const { retry: retryMigrationStart } = migrationStart

  const handleRetry = useCallback(() => {
    retryPreview()
    retryMigrationStart()
  }, [retryPreview, retryMigrationStart])

  /** Approve commits against a server-side flow, so it stays off until the server has
   *  confirmed one exists, not merely until the figures render. */
  const isApproveDisabled = !preview.isReady || !migrationStart.isStarted

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
