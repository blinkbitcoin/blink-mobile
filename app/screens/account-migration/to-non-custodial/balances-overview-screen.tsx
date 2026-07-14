import React, { useCallback, useEffect } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { InfoRow } from "@app/components/card-screen/info-row"
import { IconHero } from "@app/components/icon-hero"
import { RichText } from "@app/components/rich-text"
import { Screen } from "@app/components/screen"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useDollarBalanceRestricted } from "@app/hooks/use-dollar-balance-restricted"
import { SATS_PER_BTC } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  MigrationCheckpoint,
  useCustodialWalletBalances,
  useHardwareBackGuard,
  useMigrationCheckpoint,
  useMigrationGateArmed,
  useMigrationPreview,
} from "@app/screens/account-migration/hooks"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { AccountType } from "@app/types/wallet"
import { testProps } from "@app/utils/testProps"

const fiatSuffix = (fiat: string | undefined): string | undefined =>
  fiat ? ` (${fiat})` : undefined

/**
 * The migration commit screen: it shows the current and resulting balances plus the network
 * fee before the funds transfer. Each Dollar Balance row reads "not available" (never zero,
 * never blank) when the dollar balance is restricted in the user's region for that row's
 * account type: current follows the custodial restriction, new follows the self-custodial
 * one, so a still-custodial user knows the new account will not hold dollars. The
 * exchange-rate line is shown only on the post-gate variant, where a Dollar-to-Bitcoin
 * conversion actually happens; the voluntary and forced-pre-deadline flows never quote a
 * rate.
 */
export const MigrationBalancesOverviewScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const LLOverview = LL.AccountMigration.balancesOverview
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  /** Gate-ness is server state, not navigation state: the post-gate flow converts
   *  dollars, so this variant quotes the reference exchange rate. */
  const isPostGate = useMigrationGateArmed()

  /** The commit screen must never present unknown balances as zeros: until the wallet
   *  query settles with data, the preview area holds a spinner and Approve stays off. */
  const {
    btcBalanceSats,
    usdBalanceCents,
    isReady: isBalancePreviewReady,
  } = useCustodialWalletBalances()

  const { formatMoneyAmount, moneyAmountToDisplayCurrencyString } = useDisplayCurrency()
  const { openSupport } = useContactSupport()
  const isNewDollarBalanceRestricted = useDollarBalanceRestricted(
    AccountType.SelfCustodial,
  )
  const isCurrentDollarBalanceRestricted = useDollarBalanceRestricted(
    AccountType.Custodial,
  )
  const { loading: checkpointLoading, saveCheckpoint } = useMigrationCheckpoint()

  /** The commit point has no return path: the gesture is disabled on the
   *  route, and the hardware back is swallowed here. */
  useHardwareBackGuard()

  /** Landing here is the commit point, so an app relaunch returns to this screen.
   *  TODO: the backend will hold this server-side once the migration state query ships
   *  (reinstalls cannot be covered locally); this checkpoint covers the relaunch. */
  useEffect(() => {
    if (checkpointLoading) return
    saveCheckpoint(MigrationCheckpoint.BalancesOverview)
  }, [checkpointLoading, saveCheckpoint])

  /** The server owns the fee, the de-minimis subsidy, and the resulting amount; the
   *  screen renders the preview verbatim and never does the arithmetic itself. */
  const preview = useMigrationPreview(btcBalanceSats)

  const currentBtcAmount = toBtcMoneyAmount(preview.balanceSats)
  const newBtcAmount = toBtcMoneyAmount(preview.receiveSats)
  const feeBtcAmount = toBtcMoneyAmount(preview.feeSats)

  const currentBitcoinBalance = formatMoneyAmount({ moneyAmount: currentBtcAmount })
  const currentBitcoinFiat = fiatSuffix(
    moneyAmountToDisplayCurrencyString({ moneyAmount: currentBtcAmount }),
  )
  const newBitcoinBalance = formatMoneyAmount({ moneyAmount: newBtcAmount })
  const newBitcoinFiat = fiatSuffix(
    moneyAmountToDisplayCurrencyString({ moneyAmount: newBtcAmount }),
  )
  const currentDollarBalance = isCurrentDollarBalanceRestricted
    ? LLOverview.dollarBalanceNotAvailable()
    : formatMoneyAmount({ moneyAmount: toUsdMoneyAmount(usdBalanceCents) })
  const newDollarBalance = isNewDollarBalanceRestricted
    ? LLOverview.dollarBalanceNotAvailable()
    : formatMoneyAmount({ moneyAmount: toUsdMoneyAmount(0) })

  const feeSats = formatMoneyAmount({ moneyAmount: feeBtcAmount })
  const feeFiat = moneyAmountToDisplayCurrencyString({
    moneyAmount: feeBtcAmount,
    isApproximate: true,
  })
  const networkFee = feeFiat ? `${feeSats} (${feeFiat})` : feeSats
  const networkFeeLine = preview.feeCoveredByBlink
    ? LLOverview.networkFeeCoveredByBlink({ fee: networkFee })
    : LLOverview.networkFee({ fee: networkFee })
  const exchangeRate = isPostGate
    ? moneyAmountToDisplayCurrencyString({ moneyAmount: toBtcMoneyAmount(SATS_PER_BTC) })
    : undefined

  const handleApprove = useCallback(() => {
    navigation.navigate("accountMigrationTransferringFunds")
  }, [navigation])

  return (
    <Screen preset="fixed" headerShown={false}>
      <View style={styles.container}>
        <IconHero
          icon="send"
          iconColor={colors.primary}
          title={LLOverview.title()}
          subtitle={LLOverview.body()}
        />

        {isBalancePreviewReady ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <View style={styles.card}>
              <InfoRow
                label={LLOverview.currentBitcoinBalance()}
                value={currentBitcoinBalance}
                secondaryValue={currentBitcoinFiat}
                isLabelRegular
              />
              <View style={styles.separator} />
              <InfoRow
                label={LLOverview.currentDollarBalance()}
                value={currentDollarBalance}
                isValueMuted={isCurrentDollarBalanceRestricted}
                isLabelRegular
              />
            </View>

            <RichText text={networkFeeLine} style={styles.networkFee} />

            <View style={styles.arrowCircle}>
              <GaloyIcon name="arrow-down" size={24} color={colors.grey3} />
            </View>

            <View style={styles.card}>
              <InfoRow
                label={LLOverview.newBitcoinBalance()}
                value={newBitcoinBalance}
                secondaryValue={newBitcoinFiat}
                isLabelRegular
              />
              <View style={styles.separator} />
              <InfoRow
                label={LLOverview.newDollarBalance()}
                value={newDollarBalance}
                isValueMuted={isNewDollarBalanceRestricted}
                isLabelRegular
              />
            </View>

            {exchangeRate ? (
              <View style={styles.exchangeRateBox}>
                <Text style={styles.exchangeRateText}>
                  {LLOverview.exchangeRate({ rate: exchangeRate })}
                </Text>
              </View>
            ) : null}
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
          <GaloyPrimaryButton
            title={LLOverview.approveCta()}
            onPress={handleApprove}
            disabled={!isBalancePreviewReady}
            {...testProps("migration-balances-overview-approve")}
          />
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
  card: {
    width: "100%",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  separator: {
    height: 1,
    backgroundColor: colors.grey4,
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
