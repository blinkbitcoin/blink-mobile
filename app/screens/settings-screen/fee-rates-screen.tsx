import React, { useCallback, useMemo } from "react"
import { ActivityIndicator, Button, View } from "react-native"

import { gql } from "@apollo/client"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useFeeRatesQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { formatDepositFees } from "@app/utils/deposit-fees"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { SettingsGroup } from "./group"

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

type FeeRateRowProps = {
  label: string
  value: string
}

const FeeRateRow: React.FC<FeeRateRowProps> = ({ label, value }) => {
  const styles = useStyles()
  return (
    <View style={styles.feeRow}>
      <Text type="p2" style={styles.feeLabel}>
        {label}
      </Text>
      <Text type="p2" bold style={styles.feeValue}>
        {value}
      </Text>
    </View>
  )
}

const LoadingRow: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  return (
    <View style={styles.feeRow}>
      <ActivityIndicator testID="fee-rates-loading" animating color={colors.primary} />
    </View>
  )
}

type ErrorRowProps = {
  onRetry: () => void
}

const ErrorRow: React.FC<ErrorRowProps> = ({ onRetry }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  return (
    <View style={styles.feeRow}>
      <Text type="p2" style={[styles.feeLabel, styles.errorText]}>
        {LL.FeeRatesScreen.error()}
      </Text>
      <Button title={LL.common.tryAgain()} color={colors.error} onPress={onRetry} />
    </View>
  )
}

export const FeeRatesScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { feeRatesConfig } = useRemoteConfig()

  const { data, loading, error, refetch } = useFeeRatesQuery({
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  })

  const deposit = data?.globals?.feesInformation.deposit

  // The hook's error state already surfaces a failed retry; the catch only
  // prevents an unhandled promise rejection.
  const retry = useCallback(() => {
    refetch().catch(() => {})
  }, [refetch])

  const sendItems = useMemo(
    () => [
      function LightningSendRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.lightning()}
            value={LL.FeeRatesScreen.lightningSendFee({
              fee: formatBps(feeRatesConfig.lightningSendBps),
              routingFee: formatBps(feeRatesConfig.lightningRoutingBps),
            })}
          />
        )
      },
      function IntraledgerRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.intraledger()}
            value={LL.FeeRatesScreen.noFee()}
          />
        )
      },
      function OnchainPriorityRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.onchainPriority()}
            value={LL.FeeRatesScreen.fromApprox({
              fee: formatBps(feeRatesConfig.onchainPriorityBps),
            })}
          />
        )
      },
      function OnchainStandardRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.onchainStandard()}
            value={LL.FeeRatesScreen.fromApprox({
              fee: formatBps(feeRatesConfig.onchainStandardBps),
            })}
          />
        )
      },
      function OnchainEconomyRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.onchainEconomy()}
            value={LL.FeeRatesScreen.fromApprox({
              fee: formatBps(feeRatesConfig.onchainEconomyBps),
            })}
          />
        )
      },
    ],
    [LL, feeRatesConfig],
  )

  const receiveItems = useMemo(() => {
    const items: React.FC[] = [
      function LightningReceiveRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.lightningTransactions()}
            value={LL.FeeRatesScreen.noFee()}
          />
        )
      },
    ]
    if (deposit) {
      const { fee, threshold, overFee } = formatDepositFees(deposit)
      items.push(
        function OnchainBelowRow() {
          return (
            <FeeRateRow
              label={LL.FeeRatesScreen.onchainBelowThreshold({ threshold })}
              value={LL.FeeRatesScreen.satAmount({ amount: fee })}
            />
          )
        },
        function OnchainAboveRow() {
          return (
            <FeeRateRow
              label={LL.FeeRatesScreen.onchainAboveThreshold({ threshold })}
              value={LL.FeeRatesScreen.satAmount({ amount: overFee })}
            />
          )
        },
      )
    } else if (loading) {
      // Wrapped so SettingsGroup's `x({})` filter call creates the element
      // without executing LoadingRow's hooks in the group's render.
      items.push(function OnchainLoadingRow() {
        return <LoadingRow />
      })
    } else if (error) {
      items.push(function OnchainErrorRow() {
        return <ErrorRow onRetry={retry} />
      })
    }
    return items
  }, [LL, deposit, loading, error, retry])

  const transferItems = useMemo(
    () => [
      function TransferFeeRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.transferFee()}
            value={formatBps(feeRatesConfig.transferBps)}
          />
        )
      },
    ],
    [LL, feeRatesConfig],
  )

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{LL.FeeRatesScreen.send()}</Text>
          <SettingsGroup
            items={sendItems}
            containerStyle={styles.groupCard}
            dividerStyle={styles.hiddenDivider}
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{LL.FeeRatesScreen.receive()}</Text>
          <SettingsGroup
            items={receiveItems}
            containerStyle={styles.groupCard}
            dividerStyle={styles.hiddenDivider}
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{LL.FeeRatesScreen.transfer()}</Text>
          <SettingsGroup
            items={transferItems}
            containerStyle={styles.groupCard}
            dividerStyle={styles.hiddenDivider}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingHorizontal: 20,
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
    fontWeight: "400",
    lineHeight: 24,
  },
  groupCard: {
    paddingVertical: 5,
  },
  hiddenDivider: {
    display: "none",
  },
  feeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 16,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  feeLabel: {
    flex: 1,
    color: colors.grey1,
  },
  feeValue: {
    color: colors.black,
    textAlign: "right",
    flexShrink: 0,
  },
  errorText: {
    color: colors.error,
  },
}))
