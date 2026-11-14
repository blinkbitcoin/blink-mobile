import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { staticSurface } from "@app/rne-theme/surfaces"

export type OfferTone = "default" | "positive" | "accent"

export type OfferSummaryRow = {
  label: string
  value: string
  tone: OfferTone
}

export type SubscriptionOfferCardProps = {
  title: string
  price: string
  priceTone: OfferTone
  caption: string
  rows: OfferSummaryRow[]
}

export const SubscriptionOfferCard: React.FC<SubscriptionOfferCardProps> = ({
  title,
  price,
  priceTone,
  caption,
  rows,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const toneColor: Record<OfferTone, string> = {
    default: colors.textOnBackground,
    positive: colors.success,
    accent: colors.accent,
  }

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text type="p2" bold style={styles.centered}>
          {title}
        </Text>
        <Text type="h1" bold color={toneColor[priceTone]} style={styles.centered}>
          {price}
        </Text>
        <Text type="p3" color={colors.textMuted} style={styles.caption}>
          {caption}
        </Text>
      </View>

      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text type="p3" color={colors.textMuted} style={styles.rowText}>
            {row.label}
          </Text>
          <Text type="p3" bold color={toneColor[row.tone]} style={styles.rowText}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    ...staticSurface(colors),
    borderRadius: 12,
    padding: 14,
    gap: 14,
  },
  heading: {
    gap: 5,
  },
  centered: {
    textAlign: "center",
  },
  caption: {
    textAlign: "center",
    lineHeight: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowText: {
    lineHeight: 18,
  },
}))
