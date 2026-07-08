import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

type InfoRowProps = {
  label: string
  value: string
  secondaryValue?: string
  valueColor?: string
  valueMuted?: boolean
  regularLabel?: boolean
}

export const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  secondaryValue,
  valueColor,
  valueMuted,
  regularLabel,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const labelStyle = regularLabel ? [styles.label, styles.regularLabel] : styles.label
  const valueStyle = valueMuted
    ? [styles.value, styles.mutedValue]
    : [styles.value, { color: valueColor ?? colors.black }]

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
    color: colors.grey2,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "600",
    lineHeight: 20,
  },
  regularLabel: {
    fontWeight: "400",
  },
  value: {
    flex: 1,
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "right",
  },
  mutedValue: {
    color: colors.grey2,
    fontWeight: "400",
  },
  secondaryValue: {
    fontWeight: "400",
  },
}))
