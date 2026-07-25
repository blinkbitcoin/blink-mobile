import React from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { InfoRow } from "@app/components/card-screen/info-row"

type BalancePairCardProps = {
  bitcoinLabel: string
  bitcoinValue: string
  bitcoinFiat?: string
  dollarLabel: string
  dollarValue: string
  isDollarValueMuted?: boolean
}

/** One balances card of the commit screen: a Bitcoin row and a Dollar row. */
export const BalancePairCard: React.FC<BalancePairCardProps> = ({
  bitcoinLabel,
  bitcoinValue,
  bitcoinFiat,
  dollarLabel,
  dollarValue,
  isDollarValueMuted,
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
      <InfoRow
        label={dollarLabel}
        value={dollarValue}
        isValueMuted={isDollarValueMuted}
        isLabelRegular
      />
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
}))
