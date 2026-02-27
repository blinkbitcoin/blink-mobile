import React, { useEffect } from "react"
import { ActivityIndicator, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"

import { Screen } from "@app/components/screen"
import { LimitInput, SwitchRow } from "@app/components/card-screen"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { useI18nContext } from "@app/i18n/i18n-react"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { toMajorUnit } from "@app/utils/helper"

import { useCardData } from "../hooks/use-card-data"

import { LimitField, useCardLimits } from "./hooks"

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
      : `${currencySymbol}${toMajorUnit(cents).toLocaleString()}`

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
          <LimitInput
            testID="daily-limit-input"
            label={LL.CardFlow.CardLimits.dailySpending()}
            value={toMajorUnit(card.dailyLimitCents ?? 0).toString()}
            helperText={LL.CardFlow.CardLimits.dailyLimitHelper()}
            onChangeValue={handleUpdateDailyLimit}
            loading={updatingField === LimitField.Daily}
            disabled={updatingField === LimitField.Monthly}
          />
          <LimitInput
            testID="monthly-limit-input"
            label={LL.CardFlow.CardLimits.monthlyLimit()}
            value={toMajorUnit(card.monthlyLimitCents ?? 0).toString()}
            helperText={LL.CardFlow.CardLimits.monthlyLimitHelper()}
            onChangeValue={handleUpdateMonthlyLimit}
            loading={updatingField === LimitField.Monthly}
            disabled={updatingField === LimitField.Daily}
          />
        </View>

        <View pointerEvents="none" style={styles.disabledSection}>
          <Text style={styles.comingSoonBadge}>{LL.common.soon()}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {LL.CardFlow.CardLimits.atmLimitsTitle()}
            </Text>
            <LimitInput
              label={LL.CardFlow.CardLimits.dailyAtmLimit()}
              helperText={LL.CardFlow.CardLimits.dailyAtmLimitHelper()}
            />
            <LimitInput
              label={LL.CardFlow.CardLimits.monthlyAtmLimit()}
              helperText={LL.CardFlow.CardLimits.monthlyAtmLimitHelper()}
            />
          </View>

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
                    title={LL.CardFlow.CardLimits.TransactionTypes.atm()}
                    description={LL.CardFlow.CardLimits.TransactionTypes.atmDescription()}
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
    backgroundColor: colors.grey5,
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
