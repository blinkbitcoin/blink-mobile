import React from "react"
import { ActivityIndicator, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { InfoRow } from "@app/components/card-screen/info-row"
import { testProps } from "@app/utils/testProps"

type BalancePairCardProps = {
  bitcoinLabel: string
  bitcoinValue: string
  bitcoinFiat?: string
  dollarLabel: string
  dollarValue: string
  isDollarValueMuted?: boolean
  /** The region has not said yet whether this figure is muted. Showing the number now would
   *  state a balance the verdict may be about to withdraw, so the row waits on its own while
   *  the bitcoin row above it renders. */
  isDollarValuePending?: boolean
}

/** One balances card of the commit screen: a Bitcoin row and a Dollar row. */
export const BalancePairCard: React.FC<BalancePairCardProps> = ({
  bitcoinLabel,
  bitcoinValue,
  bitcoinFiat,
  dollarLabel,
  dollarValue,
  isDollarValueMuted,
  isDollarValuePending,
}) => {
  const styles = useStyles()

  return (
    <View style={styles.card}>
      <InfoRow
        label={bitcoinLabel}
        value={bitcoinValue}
        secondaryValue={bitcoinFiat}
        isLabelRegular
      />
      <View style={styles.separator} />
      {isDollarValuePending ? (
        <View style={styles.dollarPendingRow} {...testProps("dollar-value-pending")}>
          <Text type="p2" style={styles.dollarPendingLabel}>
            {dollarLabel}
          </Text>
          <ActivityIndicator size="small" />
        </View>
      ) : (
        <InfoRow
          label={dollarLabel}
          value={dollarValue}
          isValueMuted={isDollarValueMuted}
          isLabelRegular
        />
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
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
  dollarPendingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dollarPendingLabel: {
    color: colors.grey1,
  },
}))
