import React from "react"
import { ActivityIndicator, Pressable } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"

const ICON_SIZE = 16

type ActionButtonProps = {
  label: string
  icon: IconNamesType
  onPress: () => void
  accessibilityHint: string
  disabled?: boolean
  /** Shows progress in place of the icon; the button takes no presses meanwhile. */
  loading?: boolean
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onPress,
  accessibilityHint,
  disabled = false,
  loading = false,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const isDisabled = disabled || loading

  return (
    <Pressable
      {...testProps(label)}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {/* One line, always: a long translation ellipsizes instead of growing the row. */}
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator
          testID={`${label}-loading`}
          size="small"
          color={colors.primary}
          style={styles.spinner}
        />
      ) : (
        <GaloyIcon name={icon} size={ICON_SIZE} color={colors.primary} />
      )}
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
  // Same footprint as the icon, so the row does not shift while it spins.
  spinner: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
}))
