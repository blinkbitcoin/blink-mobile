import React from "react"
import { Pressable } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"

type ActionButtonProps = {
  label: string
  icon: IconNamesType
  onPress: () => void
  accessibilityHint: string
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onPress,
  accessibilityHint,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <Pressable
      {...testProps(label)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
    >
      <Text style={styles.label}>{label}</Text>
      <GaloyIcon name={icon} size={16} color={colors.primary} />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    backgroundColor: colors.grey5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
  },
  pressed: {
    backgroundColor: colors.grey6,
  },
  label: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.black,
  },
}))
