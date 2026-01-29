import React from "react"
import { View, TouchableOpacity } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type ActionFieldProps = {
  value: string
  onAction: () => void
  icon: IconNamesType
  label?: string
}

export const ActionField: React.FC<ActionFieldProps> = ({
  value,
  onAction,
  icon,
  label,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity onPress={onAction} style={styles.valueContainer}>
        <Text style={styles.value}>{value}</Text>
        <View style={styles.actionButton}>
          <GaloyIcon name={icon} size={20} color={colors.primary} />
        </View>
      </TouchableOpacity>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 10,
  },
  value: {
    color: colors.black,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 22,
    flex: 1,
  },
  actionButton: {
    padding: 8,
  },
}))
