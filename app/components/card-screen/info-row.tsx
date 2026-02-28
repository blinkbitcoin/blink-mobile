import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

type InfoRowProps = {
  label: string
  value: string
  valueColor?: string
}

export const InfoRow: React.FC<InfoRowProps> = ({ label, value, valueColor }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor ?? colors.black }]}>{value}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: colors.grey2,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "600",
    lineHeight: 20,
  },
  value: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "right",
  },
}))
