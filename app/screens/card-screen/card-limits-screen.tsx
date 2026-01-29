import React, { useState } from "react"
import { View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { LimitInput, TransactionTypeRow } from "@app/components/card-screen"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { useI18nContext } from "@app/i18n/i18n-react"

import { MOCK_CARD_LIMITS } from "./card-limits-mock-data"

export type TransactionType = "ecommerce" | "atm" | "contactless"

const TransactionTypes = {
  Ecommerce: "ecommerce",
  Atm: "atm",
  Contactless: "contactless",
} as const satisfies Record<string, TransactionType>

export const CardLimitsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const [spendingLimits, setSpendingLimits] = useState(MOCK_CARD_LIMITS.spendingLimits)
  const [atmLimits, setAtmLimits] = useState(MOCK_CARD_LIMITS.atmLimits)
  const [transactionTypes, setTransactionTypes] = useState(
    MOCK_CARD_LIMITS.transactionTypes,
  )

  const toggleTransactionType = (type: TransactionType) => {
    setTransactionTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))
  }

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <View style={styles.currentLimitsSection}>
          <Text style={styles.sectionTitle}>
            {LL.CardFlow.CardLimits.currentLimitsTitle()}
          </Text>
          <View style={styles.currentLimitsCard}>
            <View style={styles.currentLimitColumn}>
              <Text type="h2" style={styles.currentLimitValue}>
                {MOCK_CARD_LIMITS.currentLimits.dailySpending}
              </Text>
              <Text type="p4" style={styles.currentLimitLabel}>
                {LL.CardFlow.CardLimits.dailySpending()}
              </Text>
            </View>
            <View style={styles.currentLimitColumn}>
              <Text type="h2" style={styles.currentLimitValue}>
                {MOCK_CARD_LIMITS.currentLimits.monthlySpending}
              </Text>
              <Text type="p4" style={styles.currentLimitLabel}>
                {LL.CardFlow.CardLimits.monthlySpending()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            {LL.CardFlow.CardLimits.spendingLimitsTitle()}
          </Text>
          <LimitInput
            label={LL.CardFlow.CardLimits.dailySpending()}
            value={spendingLimits.daily}
            helperText={LL.CardFlow.CardLimits.dailyLimitHelper()}
            onChangeValue={(value) =>
              setSpendingLimits((prev) => ({ ...prev, daily: value }))
            }
          />
          <LimitInput
            label={LL.CardFlow.CardLimits.monthlyLimit()}
            value={spendingLimits.monthly}
            helperText={LL.CardFlow.CardLimits.monthlyLimitHelper()}
            onChangeValue={(value) =>
              setSpendingLimits((prev) => ({ ...prev, monthly: value }))
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            {LL.CardFlow.CardLimits.atmLimitsTitle()}
          </Text>
          <LimitInput
            label={LL.CardFlow.CardLimits.dailyAtmLimit()}
            value={atmLimits.daily}
            helperText={LL.CardFlow.CardLimits.dailyAtmLimitHelper()}
            onChangeValue={(value) => setAtmLimits((prev) => ({ ...prev, daily: value }))}
          />
          <LimitInput
            label={LL.CardFlow.CardLimits.monthlyAtmLimit()}
            value={atmLimits.monthly}
            helperText={LL.CardFlow.CardLimits.monthlyAtmLimitHelper()}
            onChangeValue={(value) =>
              setAtmLimits((prev) => ({ ...prev, monthly: value }))
            }
          />
        </View>

        <View style={styles.transactionTypesSection}>
          <Text style={styles.transactionTypesTitle}>
            {LL.CardFlow.CardLimits.transactionTypesTitle()}
          </Text>
          <SettingsGroup
            containerStyle={styles.settingsGroupContainer}
            dividerStyle={styles.dividerStyle}
            items={[
              () => (
                <TransactionTypeRow
                  title={LL.CardFlow.CardLimits.TransactionTypes.ecommerce()}
                  description={LL.CardFlow.CardLimits.TransactionTypes.ecommerceDescription()}
                  value={transactionTypes[TransactionTypes.Ecommerce]}
                  onValueChange={() => toggleTransactionType(TransactionTypes.Ecommerce)}
                />
              ),
              () => (
                <TransactionTypeRow
                  title={LL.CardFlow.CardLimits.TransactionTypes.atm()}
                  description={LL.CardFlow.CardLimits.TransactionTypes.atmDescription()}
                  value={transactionTypes[TransactionTypes.Atm]}
                  onValueChange={() => toggleTransactionType(TransactionTypes.Atm)}
                />
              ),
              () => (
                <TransactionTypeRow
                  title={LL.CardFlow.CardLimits.TransactionTypes.contactless()}
                  description={LL.CardFlow.CardLimits.TransactionTypes.contactlessDescription()}
                  value={transactionTypes[TransactionTypes.Contactless]}
                  onValueChange={() =>
                    toggleTransactionType(TransactionTypes.Contactless)
                  }
                />
              ),
            ]}
          />
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
    fontWeight: "600",
    lineHeight: 24,
  },
  sectionHeader: {
    color: colors.black,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  currentLimitsSection: {},
  currentLimitsCard: {
    flexDirection: "row",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    height: 80,
    paddingVertical: 18,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  currentLimitColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  currentLimitValue: {
    color: colors.black,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 24,
  },
  currentLimitLabel: {
    color: colors.grey2,
    fontSize: 14,
    lineHeight: 16,
    marginTop: 5,
  },
  transactionTypesSection: {
    gap: 3,
  },
  transactionTypesTitle: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 20,
  },
  settingsGroupContainer: {
    marginTop: 0,
    borderRadius: 8,
  },
  dividerStyle: {
    marginHorizontal: 22,
  },
}))
