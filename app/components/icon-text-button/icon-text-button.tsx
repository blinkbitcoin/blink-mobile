import React from "react"
import { StyleProp, TouchableOpacity, ViewStyle } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"

import { radius } from "@app/rne-theme/radius"

type IconTextButtonProps = {
  icon: IconNamesType
  label: string
  onPress: () => void
  iconColor?: string
  textColor?: string
  /** Merged over the container, e.g. Figma `button-field`'s radius and padding. */
  style?: StyleProp<ViewStyle>
}

export const IconTextButton: React.FC<IconTextButtonProps> = ({
  icon,
  label,
  onPress,
  iconColor,
  textColor,
  style,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const resolvedIconColor = iconColor ?? colors.accent
  const resolvedTextColor = textColor ?? colors.accent
  const styles = useStyles({ textColor: resolvedTextColor })

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.label}>{label}</Text>
      <GaloyIcon name={icon} size={16} color={resolvedIconColor} />
    </TouchableOpacity>
  )
}

type StyleProps = {
  textColor: string
}

const useStyles = makeStyles(({ colors }, { textColor }: StyleProps) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceInteractive,
    borderRadius: radius.default,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 8,
  },
  label: {
    color: textColor,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 20,
  },
}))
