import React from "react"
import { View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

type ReadOnlyFieldProps = {
  label: string
  value: string
}

export const ReadOnlyField: React.FC<ReadOnlyFieldProps> = ({ label, value }) => {
  const styles = useStyles()

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueContainer}>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: 3,
  },
  label: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  valueContainer: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 5,
    justifyContent: "center",
  },
  value: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 20,
  },
}))
