import React from "react"
import { Pressable, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { fonts } from "@app/rne-theme/fonts"

import { GaloyIcon } from "../atomic/galoy-icon"

const DEFAULT_GAP = 10
const DEFAULT_LABEL_LINE_HEIGHT = 20
/** Reaches into the gap beside the box, so a tap between it and the label still lands
 *  on it; the row's own bounds clip the rest. */
const BOX_HIT_SLOP = 12

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
  /**
   * A label with inline parts, such as links, set in the row's text style. The box is
   * then a checkbox of its own, named after the label's words, and the label sits beside
   * it: inside one checkbox a screen reader could not reach the links, and activating
   * one would toggle the box instead of opening it. Pressing the label's prose still
   * toggles the box, as on a plain row, while a link keeps its own press.
   */
  | { label?: never; children: React.ReactNode }
)

/** The words a label shows, so the box is named after exactly what is on screen. */
const textOf = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textOf(node.props.children)
  }
  return ""
}

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

  const hasRichLabel = label === undefined
  const rowStyle = [
    styles.container,
    centered && styles.centered,
    disabled && styles.disabled,
  ]
  const labelStyle = [styles.label, centered && styles.labelCentered]
  const box = (
    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
      {isChecked && <GaloyIcon name="check" size={14} color={colors.textOnAccent} />}
    </View>
  )

  if (hasRichLabel) {
    /** A disabled row keeps its links open, so the documents can still be read. */
    const handleProsePress = disabled ? undefined : onPress

    return (
      <View style={rowStyle}>
        <Pressable
          disabled={disabled}
          onPress={onPress}
          hitSlop={BOX_HIT_SLOP}
          accessibilityRole="checkbox"
          accessibilityLabel={textOf(children)}
          accessibilityState={{ checked: isChecked, disabled }}
          testID={testID}
        >
          {box}
        </Pressable>
        <Text style={labelStyle} onPress={handleProsePress} suppressHighlighting>
          {children}
        </Text>
      </View>
    )
  }

  return (
    <Pressable
      disabled={disabled}
      style={rowStyle}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      testID={testID}
    >
      {box}
      <Text style={labelStyle}>{label}</Text>
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
