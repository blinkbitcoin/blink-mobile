import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { fonts } from "@app/rne-theme/fonts"

type InfoRowProps = {
  label: string
  value: string
  secondaryValue?: string
  valueColor?: string
  isValueMuted?: boolean
  isLabelRegular?: boolean
}

export const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  secondaryValue,
  valueColor,
  isValueMuted,
  isLabelRegular,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const labelStyle = isLabelRegular ? [styles.label, styles.regularLabel] : styles.label
  const valueStyle = isValueMuted
    ? [styles.value, styles.mutedValue]
    : [styles.value, { color: valueColor ?? colors.textOnBackground }]

  return (
    <View style={styles.container}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>
        {value}
        {secondaryValue ? (
          <Text style={styles.secondaryValue}>{secondaryValue}</Text>
        ) : null}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  label: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.bold,
    lineHeight: 20,
  },
  regularLabel: {
    fontFamily: fonts.regular,
  },
  value: {
    flex: 1,
    color: colors.textOnBackground,
    fontSize: 14,
    fontFamily: fonts.bold,
    lineHeight: 20,
    textAlign: "right",
  },
  mutedValue: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  secondaryValue: {
    fontFamily: fonts.regular,
  },
}))
