import React from "react"
import { ActivityIndicator, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialConversionLimits } from "@app/self-custodial/hooks/use-self-custodial-conversion-limits"
import { testProps } from "@app/utils/testProps"

const formatSats = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : `${value.toLocaleString("en-US")} sats`

const formatCents = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—"
  return `$${(value / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const SelfCustodialTransactionLimitsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { btcToUsd, usdToBtc, loading, error } = useSelfCustodialConversionLimits()

  const renderLimits = (): React.ReactNode => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
        </View>
      )
    }
    if (error) {
      return (
        <Text style={styles.errorText} {...testProps("transaction-limits-error")}>
          {LL.SettingsScreen.TransactionLimits.loadError()}
        </Text>
      )
    }
    return (
      <>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {LL.SettingsScreen.TransactionLimits.btcToUsdTitle()}
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>
              {LL.SettingsScreen.TransactionLimits.minFromLabel()}
            </Text>
            <Text style={styles.value} {...testProps("btc-to-usd-min-from")}>
              {formatSats(btcToUsd?.minFromAmount)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {LL.SettingsScreen.TransactionLimits.minToLabel()}
            </Text>
            <Text style={styles.value} {...testProps("btc-to-usd-min-to")}>
              {formatCents(btcToUsd?.minToAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {LL.SettingsScreen.TransactionLimits.usdToBtcTitle()}
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>
              {LL.SettingsScreen.TransactionLimits.minFromLabel()}
            </Text>
            <Text style={styles.value} {...testProps("usd-to-btc-min-from")}>
              {formatCents(usdToBtc?.minFromAmount)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {LL.SettingsScreen.TransactionLimits.minToLabel()}
            </Text>
            <Text style={styles.value} {...testProps("usd-to-btc-min-to")}>
              {formatSats(usdToBtc?.minToAmount)}
            </Text>
          </View>
        </View>
      </>
    )
  }

  return (
    <Screen preset="scroll" keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.note}>
          {LL.SettingsScreen.TransactionLimits.protocolNote()}
        </Text>

        {renderLimits()}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  note: {
    color: colors.grey2,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
    gap: 8,
  },
  sectionTitle: {
    color: colors.black,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey5,
  },
  label: {
    color: colors.grey2,
    fontSize: 14,
    lineHeight: 20,
  },
  value: {
    color: colors.black,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
}))
