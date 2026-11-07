import React from "react"
import { Pressable, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../atomic/galoy-icon"

type CheckboxRowProps = {
  label: string
  isChecked: boolean
  onPress: () => void
  centered?: boolean
  disabled?: boolean
  testID?: string
  /** For a coloured ground: border, label and checked fill. Defaults to the theme's. */
  color?: string
  /** The tick's colour on a `color` fill. Defaults to white. */
  checkColor?: string
  /** Keeps the label on one line. Translations are written to fit; this is the guard. */
  singleLine?: boolean
}

export const CheckboxRow: React.FC<CheckboxRowProps> = ({
  label,
  isChecked,
  onPress,
  centered,
  disabled,
  testID,
  color,
  checkColor,
  singleLine,
}) => {
  const styles = useStyles()
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
      <View
        style={[
          styles.checkbox,
          isChecked && styles.checkboxChecked,
          color ? { borderColor: color } : undefined,
          color && isChecked ? { backgroundColor: color } : undefined,
        ]}
      >
        {isChecked && (
          <GaloyIcon name="check" size={14} color={checkColor ?? colors.white} />
        )}
      </View>
      <Text
        style={[
          styles.label,
          centered && styles.labelCentered,
          singleLine && styles.labelSingleLine,
          color ? { color } : undefined,
        ]}
        numberOfLines={singleLine ? 1 : undefined}
        adjustsFontSizeToFit={singleLine}
      >
        {label}
      </Text>
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
  centered: {
    alignSelf: "center",
  },
  labelCentered: {
    flex: 0,
  },
  labelSingleLine: {
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.5,
  },
}))
