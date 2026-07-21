import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"
import { useIsFocused, useNavigation } from "@react-navigation/native"
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

  /** Landing here is the commit point, so an app relaunch returns to this screen.
   *  Gated on focus: this screen stays mounted under the completion screen, and once the
   *  migration clears the checkpoint a background re-save would resurrect it.
   *  TODO: the backend will hold this server-side once the migration state query ships
   *  (reinstalls cannot be covered locally); this checkpoint covers the relaunch. */
  /** Approve is the point of no return, so it only unlocks once this checkpoint is durably
   *  written: tapping before the write lands could resume a post-crash relaunch at the wrong
   *  step. */
  const [isCheckpointSaved, setIsCheckpointSaved] = useState(false)
  const [hasCheckpointSaveFailed, setHasCheckpointSaveFailed] = useState(false)
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false)
  const [saveAttempt, setSaveAttempt] = useState(0)

  useEffect(() => {
    if (!isFocused || checkpointLoading) return
    let isActive = true
    setIsSavingCheckpoint(true)
    saveCheckpoint(MigrationCheckpoint.BalancesOverview)
      .then((saved) => {
        if (!isActive) return
        setIsCheckpointSaved(saved)
        setHasCheckpointSaveFailed(!saved)
      })
      .finally(() => {
        if (isActive) setIsSavingCheckpoint(false)
      })
    return () => {
      isActive = false
    }
  }, [isFocused, checkpointLoading, saveCheckpoint, saveAttempt])

  /** A failed save (an offline owner query, a failed write) leaves Approve disabled, and
   *  nothing else on this exit-sealed screen re-runs it: the effect's dependencies never
   *  change once it has settled, so without a manual retry the user would be stranded at the
   *  commit point with no way back. Retry re-runs the save, exactly as the gate's does. */
  const retryCheckpointSave = useCallback(() => {
    setSaveAttempt((previous) => previous + 1)
  }, [])

  const handleApprove = useCallback(() => {
    navigation.navigate("accountMigrationTransferringFunds")
  }, [navigation])

  const isApproveDisabled = !preview.isReady || !isCheckpointSaved

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

            {preview.exchangeRate && (
              <View style={styles.exchangeRateBox}>
                <Text style={styles.exchangeRateText}>
                  {LLOverview.exchangeRate({ rate: preview.exchangeRate })}
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
              {...testProps("migration-balances-overview-loading")}
            />
          </View>
        )}

        <View style={styles.buttonsContainer}>
          {hasCheckpointSaveFailed ? (
            <>
              <Text style={styles.saveErrorText}>{LL.errors.generic()}</Text>
              <GaloyPrimaryButton
                title={LL.common.tryAgain()}
                onPress={retryCheckpointSave}
                loading={isSavingCheckpoint}
                disabled={isSavingCheckpoint}
                {...testProps("migration-balances-overview-retry")}
              />
            </>
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
  saveErrorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.error,
    textAlign: "center",
    paddingHorizontal: 20,
  },
}))
