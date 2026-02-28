import React from "react"
import { Pressable, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import Icon from "react-native-vector-icons/Ionicons"

type CheckboxRowProps = {
  label: string
  isChecked: boolean
  onPress: () => void
}

export const CheckboxRow: React.FC<CheckboxRowProps> = ({
  label,
  isChecked,
  onPress,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
    >
      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
        {isChecked && <Icon name="checkmark" size={14} color={colors.white} />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.grey3,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    flex: 1,
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
}))
