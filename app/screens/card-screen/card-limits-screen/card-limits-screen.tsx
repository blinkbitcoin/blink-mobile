import React, { useEffect } from "react"
import { ActivityIndicator, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { InputField, SwitchRow } from "@app/components/card-screen"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { useI18nContext } from "@app/i18n/i18n-react"
import { SpendingPeriod, WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { parseDollarsToCents, toMajorUnit } from "@app/utils/helper"
import { staticSurface } from "@app/rne-theme/surfaces"

import { useCardData } from "@app/hooks"

import { LimitField, useCardAtmControls, useCardLimits } from "./hooks"
import { createCurrencyFormatters } from "../utils"

const toAtmLimitValue = (cents: number | null) =>
  cents === null ? "" : toMajorUnit(cents).toString()

export const CardLimitsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { getCurrencySymbol } = useDisplayCurrency()
  const currencySymbol = getCurrencySymbol({ currency: WalletCurrency.Usd })
  const navigation = useNavigation()

  const { card, loading } = useCardData()
  const { handleUpdateDailyLimit, handleUpdateMonthlyLimit, updatingField } =
    useCardLimits(card?.id ?? "")
  const {
    atmDailyLimitCents,
    atmMonthlyLimitCents,
    isAtmEnabled,
    hasAtmControls,
    isAtmControlsLoading,
    hasAtmControlsFailed,
    retryAtmControls,
    updatingAtmLimit,
    isTogglingAtm,
    handleUpdateAtmDailyLimit,
    handleUpdateAtmMonthlyLimit,
    handleToggleAtm,
  } = useCardAtmControls(card?.id ?? "")

  const { formatAmount } = createCurrencyFormatters(currencySymbol)

  useEffect(() => {
    if (!loading && !card) {
      navigation.goBack()
    }
  }, [loading, card, navigation])

  if (loading || !card) {
    return (
      <Screen preset="scroll">
        <ActivityIndicator
          testID="activity-indicator"
          style={styles.loader}
          color={colors.primary}
        />
      </Screen>
    )
  }

  const formatLimitCents = (cents: number | null) =>
    cents === null
      ? LL.CardFlow.CardLimits.noLimit()
      : formatAmount(toMajorUnit(cents).toString())

  /** An ATM limit is optional, so an empty field keeps its "No limit" placeholder
   *  instead of being formatted as a zero amount. */
  const formatAtmLimit = (value: string) => (value ? formatAmount(value) : value)

  /** Compared as the parsed amount, so a value typed with a comma that matches the saved
   *  limit is not sent again. An emptied field reads as zero, as it always has, so leaving
   *  it empty where no limit is set changes nothing. */
  const isSpendingLimitUnchanged = (
    value: string,
    savedCents: number | null | undefined,
  ) => {
    const isBlank = value.trim() === ""
    const typedCents = isBlank ? 0 : parseDollarsToCents(value)
    return typedCents === (savedCents ?? 0)
  }

  const isSavingAtmLimit = updatingAtmLimit !== null
  const isSavingAtmDailyLimit = updatingAtmLimit === SpendingPeriod.Daily
  const isSavingAtmMonthlyLimit = updatingAtmLimit === SpendingPeriod.Monthly

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <View>
          <Text style={styles.currentLimitsTitle}>
            {LL.CardFlow.CardLimits.currentLimitsTitle()}
          </Text>
          <View style={styles.currentLimitsCard}>
            <View style={styles.currentLimitColumn}>
              <Text style={styles.currentLimitValue}>
                {formatLimitCents(card.dailyLimitCents ?? null)}
              </Text>
              <Text type="p4" style={styles.currentLimitLabel}>
                {LL.CardFlow.CardLimits.dailySpending()}
              </Text>
            </View>
            <View style={styles.currentLimitColumn}>
              <Text style={styles.currentLimitValue}>
                {formatLimitCents(card.monthlyLimitCents ?? null)}
              </Text>
              <Text type="p4" style={styles.currentLimitLabel}>
                {LL.CardFlow.CardLimits.monthlySpending()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {LL.CardFlow.CardLimits.spendingLimitsTitle()}
          </Text>
          <InputField
            testID="daily-limit-input"
            label={LL.CardFlow.CardLimits.dailySpending()}
            value={toMajorUnit(card.dailyLimitCents ?? 0).toString()}
            helperText={LL.CardFlow.CardLimits.dailyLimitHelper()}
            size="large"
            keyboardType="decimal-pad"
            formatDisplay={formatAmount}
            onBlur={(value) => {
              if (!isSpendingLimitUnchanged(value, card.dailyLimitCents))
                handleUpdateDailyLimit(value)
            }}
            loading={updatingField === LimitField.Daily}
            disabled={updatingField !== null}
          />
          <InputField
            testID="monthly-limit-input"
            label={LL.CardFlow.CardLimits.monthlyLimit()}
            value={toMajorUnit(card.monthlyLimitCents ?? 0).toString()}
            helperText={LL.CardFlow.CardLimits.monthlyLimitHelper()}
            size="large"
            keyboardType="decimal-pad"
            formatDisplay={formatAmount}
            onBlur={(value) => {
              if (!isSpendingLimitUnchanged(value, card.monthlyLimitCents))
                handleUpdateMonthlyLimit(value)
            }}
            loading={updatingField === LimitField.Monthly}
            disabled={updatingField !== null}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {LL.CardFlow.CardLimits.atmLimitsTitle()}
          </Text>
          {/* The ATM controls load on their own, so the spending limits above stay
              usable while they load or after they fail. */}
          {isAtmControlsLoading && (
            <ActivityIndicator testID="atm-controls-loading" color={colors.primary} />
          )}
          {hasAtmControlsFailed && (
            <View style={styles.atmControlsFailure}>
              <GaloyErrorBox
                errorMessage={LL.CardFlow.CardLimits.atmControlsLoadError()}
              />
              <GaloyPrimaryButton
                title={LL.common.tryAgain()}
                onPress={retryAtmControls}
              />
            </View>
          )}
          {hasAtmControls && (
            <>
              <View style={styles.atmSwitchCard}>
                <SwitchRow
                  title={LL.CardFlow.CardLimits.TransactionTypes.atm()}
                  description={LL.CardFlow.CardLimits.TransactionTypes.atmDescription()}
                  value={isAtmEnabled}
                  onValueChange={handleToggleAtm}
                  disabled={isTogglingAtm}
                />
              </View>
              <InputField
                testID="atm-daily-limit-input"
                label={LL.CardFlow.CardLimits.dailyAtmLimit()}
                value={toAtmLimitValue(atmDailyLimitCents)}
                placeholder={LL.CardFlow.CardLimits.noLimit()}
                helperText={LL.CardFlow.CardLimits.dailyAtmLimitHelper()}
                size="large"
                keyboardType="decimal-pad"
                formatDisplay={formatAtmLimit}
                onBlur={handleUpdateAtmDailyLimit}
                loading={isSavingAtmDailyLimit}
                disabled={isSavingAtmLimit}
              />
              <InputField
                testID="atm-monthly-limit-input"
                label={LL.CardFlow.CardLimits.monthlyAtmLimit()}
                value={toAtmLimitValue(atmMonthlyLimitCents)}
                placeholder={LL.CardFlow.CardLimits.noLimit()}
                helperText={LL.CardFlow.CardLimits.monthlyAtmLimitHelper()}
                size="large"
                keyboardType="decimal-pad"
                formatDisplay={formatAtmLimit}
                onBlur={handleUpdateAtmMonthlyLimit}
                loading={isSavingAtmMonthlyLimit}
                disabled={isSavingAtmLimit}
              />
            </>
          )}
        </View>

        <View pointerEvents="none" style={styles.disabledSection}>
          <Text style={styles.comingSoonBadge}>{LL.common.soon()}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {LL.CardFlow.CardLimits.transactionTypesTitle()}
            </Text>
            <SettingsGroup
              containerStyle={styles.settingsGroupContainer}
              dividerStyle={styles.dividerStyle}
              items={[
                () => (
                  <SwitchRow
                    title={LL.CardFlow.CardLimits.TransactionTypes.ecommerce()}
                    description={LL.CardFlow.CardLimits.TransactionTypes.ecommerceDescription()}
                  />
                ),
                () => (
                  <SwitchRow
                    title={LL.CardFlow.CardLimits.TransactionTypes.contactless()}
                    description={LL.CardFlow.CardLimits.TransactionTypes.contactlessDescription()}
                  />
                ),
              ]}
            />
          </View>
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
  },
  section: {
    gap: 20,
  },
  sectionTitle: {
    color: colors.black,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
  },
  currentLimitsTitle: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  currentLimitsCard: {
    flexDirection: "row",
    ...staticSurface(colors),
    borderRadius: 8,
    minHeight: 80,
    paddingVertical: 18,
    paddingHorizontal: 10,
    marginTop: 3,
  },
  currentLimitColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  currentLimitValue: {
    color: colors.black,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  currentLimitLabel: {
    color: colors.grey2,
    fontSize: 14,
    lineHeight: 16,
    marginTop: 5,
  },
  disabledSection: {
    gap: 20,
    opacity: 0.4,
  },
  comingSoonBadge: {
    color: colors.black,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "center",
  },
  settingsGroupContainer: {
    marginTop: 0,
    borderRadius: 8,
  },
  atmControlsFailure: {
    gap: 10,
  },
  atmSwitchCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    overflow: "hidden",
  },
  dividerStyle: {
    marginHorizontal: 22,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
}))
