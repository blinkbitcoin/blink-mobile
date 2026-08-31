import React, { useCallback, useMemo } from "react"
import { ActivityIndicator, Button, View } from "react-native"

import { gql } from "@apollo/client"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useFeeRatesQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { formatDepositFeeTiers } from "@app/utils/deposit-fees"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { SettingsGroup } from "./group"

gql`
  query feeRates {
    globals {
      feesInformation {
        deposit {
          minBankFee
          minBankFeeThreshold
          tiers {
            maxAmount
            amount
          }
        }
      }
    }
  }
`

const formatBps = (bps: number): string =>
  `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`

// A tier is bounded below by the previous tier's ceiling and above by its own;
// the first tier has no lower bound and the last has no upper one.
const depositTierLabel = (
  LL: TranslationFunctions,
  minAmount: string | null,
  maxAmount: string | null,
): string => {
  if (maxAmount === null) {
    return LL.FeeRatesScreen.onchainAboveThreshold({ threshold: minAmount ?? "0" })
  }
  if (minAmount === null) {
    return LL.FeeRatesScreen.onchainBelowThreshold({ threshold: maxAmount })
  }
  return LL.FeeRatesScreen.onchainBetweenThresholds({
    lower: minAmount,
    upper: maxAmount,
  })
}

// Remote-config contract: a negative rate hides its row (and the section when
// no rows remain), 0 renders as "no fee", positive values render the rate.
const isRowVisible = (bps: number): boolean => bps >= 0

// Lightning sends under this amount are not charged. Fixed server-side rather
// than priced through feeRatesConfig, so it is a constant here; move it onto
// the remote config if it ever needs to change without an app release.
const LIGHTNING_FREE_BELOW_SATS = 100

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

  const sendItems = useMemo(() => {
    const tierValue = (bps: number) =>
      bps === 0
        ? LL.FeeRatesScreen.noFee()
        : LL.FeeRatesScreen.fromApprox({ fee: formatBps(bps) })

    const items: React.FC[] = []
    if (isRowVisible(feeRatesConfig.lightningSendBps)) {
      items.push(function LightningSendRow() {
        const isFree =
          feeRatesConfig.lightningSendBps === 0 && feeRatesConfig.lightningRoutingBps <= 0
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.lightning()}
            value={
              isFree
                ? LL.FeeRatesScreen.noFee()
                : LL.FeeRatesScreen.lightningSendFee({
                    fee: formatBps(feeRatesConfig.lightningSendBps),
                    routingFee: formatBps(
                      Math.max(feeRatesConfig.lightningRoutingBps, 0),
                    ),
                  })
            }
          />
        )
      })
      // Qualifies the row above, so it is gated on the same flag: hiding
      // lightning sends must not leave its exemption stranded on its own.
      items.push(function LightningBelowThresholdRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.lightningBelowThreshold({
              threshold: LIGHTNING_FREE_BELOW_SATS.toLocaleString("en-US"),
            })}
            value={LL.FeeRatesScreen.noFee()}
          />
        )
      })
    }
    items.push(function IntraledgerRow() {
      return (
        <FeeRateRow
          label={LL.FeeRatesScreen.intraledger()}
          value={LL.FeeRatesScreen.noFee()}
        />
      )
    })
    if (isRowVisible(feeRatesConfig.onchainPriorityBps)) {
      items.push(function OnchainPriorityRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.onchainPriority()}
            value={tierValue(feeRatesConfig.onchainPriorityBps)}
          />
        )
      })
    }
    if (isRowVisible(feeRatesConfig.onchainStandardBps)) {
      items.push(function OnchainStandardRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.onchainStandard()}
            value={tierValue(feeRatesConfig.onchainStandardBps)}
          />
        )
      })
    }
    if (isRowVisible(feeRatesConfig.onchainEconomyBps)) {
      items.push(function OnchainEconomyRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.onchainEconomy()}
            value={tierValue(feeRatesConfig.onchainEconomyBps)}
          />
        )
      })
    }
    return items
  }, [LL, feeRatesConfig])

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
      // One row per tier, so a tier added server-side shows up on its own
      // instead of being folded into a neighbour's range.
      formatDepositFeeTiers(deposit).forEach(({ amount, minAmount, maxAmount }) => {
        const label = depositTierLabel(LL, minAmount, maxAmount)
        items.push(function OnchainTierRow() {
          return (
            <FeeRateRow label={label} value={LL.FeeRatesScreen.satAmount({ amount })} />
          )
        })
      })
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

  const transferItems = useMemo(() => {
    if (!isRowVisible(feeRatesConfig.transferBps)) return []
    return [
      function TransferFeeRow() {
        return (
          <FeeRateRow
            label={LL.FeeRatesScreen.transferFee()}
            value={
              feeRatesConfig.transferBps === 0
                ? LL.FeeRatesScreen.noFee()
                : formatBps(feeRatesConfig.transferBps)
            }
          />
        )
      },
    ]
  }, [LL, feeRatesConfig])

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
        {transferItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{LL.FeeRatesScreen.transfer()}</Text>
            <SettingsGroup
              items={transferItems}
              containerStyle={styles.groupCard}
              dividerStyle={styles.hiddenDivider}
            />
          </View>
        )}
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
