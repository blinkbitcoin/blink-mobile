import React from "react"
import { Pressable, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { fonts } from "@app/rne-theme/fonts"

import { GaloyIcon } from "../atomic/galoy-icon"

const DEFAULT_GAP = 10
const DEFAULT_LABEL_LINE_HEIGHT = 20

type StyleProps = {
  gap: number
  labelLineHeight: number
}

type CheckboxRowProps = {
  isChecked: boolean
  onPress: () => void
  centered?: boolean
  disabled?: boolean
  testID?: string
  /** The space between the box and its label. */
  gap?: number
  labelLineHeight?: number
} & (
  | { label: string; children?: never }
  /** A label with inline parts, such as links, set in the row's text style. */
  | { label?: never; children: React.ReactNode }
)

export const CheckboxRow: React.FC<CheckboxRowProps> = ({
  label,
  children,
  isChecked,
  onPress,
  centered,
  disabled,
  testID,
  gap = DEFAULT_GAP,
  labelLineHeight = DEFAULT_LABEL_LINE_HEIGHT,
}) => {
  const styles = useStyles({ gap, labelLineHeight })
  const {
    theme: { colors },
  } = useTheme()

  return (
    <Pressable
      disabled={disabled}
      style={[styles.container, centered && styles.centered, disabled && styles.disabled]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      testID={testID}
    >
      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
        {isChecked && <GaloyIcon name="check" size={14} color={colors.textOnAccent} />}
      </View>
      <Text style={[styles.label, centered && styles.labelCentered]}>
        {children ?? label}
      </Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }, { gap, labelLineHeight }: StyleProps) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.textDisabled,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  label: {
    flex: 1,
    color: colors.textOnBackground,
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: labelLineHeight,
  },
  centered: {
    alignSelf: "center",
  },
  labelCentered: {
    flex: 0,
  },
  disabled: {
    opacity: 0.5,
  },
}))
