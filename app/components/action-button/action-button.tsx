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
  disabled?: boolean
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onPress,
  accessibilityHint,
  disabled = false,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <Pressable
      {...testProps(label)}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      {/* One line, always: a long translation ellipsizes instead of growing the row. */}
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
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
    flexShrink: 1,
    minWidth: 0,
  },
  pressed: {
    backgroundColor: colors.grey6,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "400",
    color: colors.black,
  },
}))
