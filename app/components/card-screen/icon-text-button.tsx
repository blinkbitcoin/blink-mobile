import React from "react"
import { TouchableOpacity } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type IconTextButtonProps = {
  icon: IconNamesType
  label: string
  onPress: () => void
  iconColor?: string
  textColor?: string
}

export const IconTextButton: React.FC<IconTextButtonProps> = ({
  icon,
  label,
  onPress,
  iconColor,
  textColor,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const resolvedIconColor = iconColor ?? colors.primary
  const resolvedTextColor = textColor ?? colors.primary
  const styles = useStyles({ textColor: resolvedTextColor })

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <GaloyIcon name={icon} size={16} color={resolvedIconColor} />
      <Text style={styles.label}>{label}</Text>
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
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 8,
  },
  label: {
    color: textColor,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "600",
    lineHeight: 20,
  },
}))
