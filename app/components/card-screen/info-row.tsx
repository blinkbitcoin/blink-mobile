import React from "react"
import { ActivityIndicator, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "@app/utils/testProps"

type InfoRowProps = {
  label: string
  value: string
  secondaryValue?: string
  valueColor?: string
  isValueMuted?: boolean
  isLabelRegular?: boolean
  /** Swaps the value for a spinner that keeps the row's height, so it doesn't jump when the
   *  value lands. */
  loading?: boolean
  valueTestId?: string
}

export const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  secondaryValue,
  valueColor,
  isValueMuted,
  isLabelRegular,
  loading = false,
  valueTestId,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const labelStyle = isLabelRegular ? [styles.label, styles.regularLabel] : styles.label
  const valueStyle = isValueMuted
    ? [styles.value, styles.mutedValue]
    : [styles.value, { color: valueColor ?? colors.black }]

  return (
    <View style={styles.container}>
      <Text style={labelStyle}>{label}</Text>
      {loading ? (
        <View style={styles.loadingSlot}>
          {/* An invisible line holds the height the value will take, at any text size. */}
          <Text style={[styles.value, styles.hidden]}> </Text>
          <ActivityIndicator
            size="small"
            color={colors.grey2}
            style={styles.spinner}
            {...testProps(`${label} loading`)}
          />
        </View>
      ) : (
        <Text style={valueStyle} {...(valueTestId ? testProps(valueTestId) : {})}>
          {value}
          {secondaryValue ? (
            <Text style={styles.secondaryValue}>{secondaryValue}</Text>
          ) : null}
        </Text>
      )}
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
  loadingSlot: {
    flex: 1,
    justifyContent: "center",
  },
  hidden: {
    opacity: 0,
  },
  spinner: {
    position: "absolute",
    right: 0,
    transform: [{ scale: 0.8 }],
  },
}))
