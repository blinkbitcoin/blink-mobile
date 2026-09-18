import React from "react"
import { ActivityIndicator, StyleProp, TouchableOpacity, ViewStyle } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "@app/utils/testProps"
import { fonts } from "@app/rne-theme/fonts"

export type ChipProps = {
  label: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
  loading?: boolean
  testID?: string
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export const Chip: React.FC<ChipProps> = ({
  label,
  onPress,
  selected = false,
  disabled = false,
  loading = false,
  testID,
  accessibilityLabel,
  style,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const isSelected = !loading && selected

  return (
    <TouchableOpacity
      {...(testID ? testProps(testID) : {})}
      style={[
        styles.chip,
        isSelected && styles.chipSelected,
        disabled && styles.chipDisabled,
        style,
      ]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: isSelected, disabled }}
    >
      {/* The label keeps its space under the spinner so the chip doesn't resize. */}
      <Text
        style={[
          styles.chipText,
          isSelected && styles.chipTextSelected,
          loading && styles.chipTextHidden,
        ]}
      >
        {label}
      </Text>
      {loading && <ActivityIndicator style={styles.spinner} color={colors.primary} />}
    </TouchableOpacity>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  chip: {
    backgroundColor: colors.grey5,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  chipTextSelected: {
    color: colors.white,
  },
  chipTextHidden: {
    opacity: 0,
  },
  spinner: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
}))
