import React from "react"
import { ActivityIndicator, Button, View } from "react-native"

import { gql } from "@apollo/client"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useFeeRatesQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { SettingsGroup } from "./group"

const DEFAULT_OVER_FEE = 5000

gql`
  query feeRates {
    globals {
      feesInformation {
        deposit {
          minBankFee
          minBankFeeThreshold
          ratio
        }
      }
    }
  }
`

const formatBps = (bps: number): string =>
  `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`

export const FeeRatesScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { feeRatesConfig } = useRemoteConfig()

  const { data, loading, error, refetch } = useFeeRatesQuery({
    fetchPolicy: "cache-and-network",
  })

  const deposit = data?.globals?.feesInformation.deposit

  const FeeRow = (label: string, value: string) => {
    const Row: React.FC = () => (
      <View style={styles.feeRow}>
        <Text type="p2" style={styles.feeLabel}>
          {label}
        </Text>
        <Text type="p2" style={styles.feeValue}>
          {value}
        </Text>
      </View>
    )
    return Row
  }

  const sendItems = [
    FeeRow(
      LL.FeeRatesScreen.lightning(),
      LL.FeeRatesScreen.lightningSendFee({
        fee: formatBps(feeRatesConfig.lightningSendBps),
        routingFee: formatBps(feeRatesConfig.lightningRoutingBps),
      }),
    ),
    FeeRow(LL.FeeRatesScreen.intraledger(), LL.FeeRatesScreen.noFee()),
    FeeRow(
      LL.FeeRatesScreen.onchainPriority(),
      LL.FeeRatesScreen.fromApprox({
        fee: formatBps(feeRatesConfig.onchainPriorityBps),
      }),
    ),
    FeeRow(
      LL.FeeRatesScreen.onchainStandard(),
      LL.FeeRatesScreen.fromApprox({
        fee: formatBps(feeRatesConfig.onchainStandardBps),
      }),
    ),
    FeeRow(
      LL.FeeRatesScreen.onchainEconomy(),
      LL.FeeRatesScreen.fromApprox({
        fee: formatBps(feeRatesConfig.onchainEconomyBps),
      }),
    ),
  ]

  const receiveItems = [
    FeeRow(LL.FeeRatesScreen.lightningTransactions(), LL.FeeRatesScreen.noFee()),
  ]
  if (deposit) {
    const threshold = new Intl.NumberFormat("en-US", { notation: "compact" }).format(
      Number(deposit.minBankFeeThreshold),
    )
    const belowFee = Number(deposit.minBankFee).toLocaleString("en-US")
    const computedOverFee = Math.round(
      (Number(deposit.minBankFeeThreshold) * Number(deposit.ratio)) / 10000,
    )
    const aboveFee = (computedOverFee || DEFAULT_OVER_FEE).toLocaleString("en-US")

    receiveItems.push(
      FeeRow(
        LL.FeeRatesScreen.onchainBelowThreshold({ threshold }),
        LL.FeeRatesScreen.satAmount({ amount: belowFee }),
      ),
      FeeRow(
        LL.FeeRatesScreen.onchainAboveThreshold({ threshold }),
        LL.FeeRatesScreen.satAmount({ amount: aboveFee }),
      ),
    )
  } else if (loading) {
    const LoadingRow: React.FC = () => (
      <View style={styles.feeRow}>
        <ActivityIndicator testID="fee-rates-loading" animating color={colors.primary} />
      </View>
    )
    receiveItems.push(LoadingRow)
  } else if (error) {
    const ErrorRow: React.FC = () => (
      <View style={styles.feeRow}>
        <Text type="p2" style={[styles.feeLabel, styles.errorText]}>
          {LL.FeeRatesScreen.error()}
        </Text>
        <Button
          title={LL.common.tryAgain()}
          color={colors.error}
          onPress={() => refetch()}
        />
      </View>
    )
    receiveItems.push(ErrorRow)
  }

  const transferItems = [
    FeeRow(LL.FeeRatesScreen.transferFee(), formatBps(feeRatesConfig.transferBps)),
  ]

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{LL.FeeRatesScreen.send()}</Text>
          <SettingsGroup items={sendItems} />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{LL.FeeRatesScreen.receive()}</Text>
          <SettingsGroup items={receiveItems} />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{LL.FeeRatesScreen.transfer()}</Text>
          <SettingsGroup items={transferItems} />
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
    gap: 5,
  },
  sectionTitle: {
    color: colors.black,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
  },
  feeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 16,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  feeLabel: {
    flex: 1,
  },
  feeValue: {
    color: colors.grey1,
    textAlign: "right",
    flexShrink: 0,
  },
  errorText: {
    color: colors.error,
  },
}))
