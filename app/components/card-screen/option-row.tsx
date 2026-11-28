import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { fonts } from "@app/rne-theme/fonts"

type OptionRowProps = {
  icon: IconNamesType
  iconColor: string
  title: string
  subtitle: string
  value?: string
  valueColor?: string
  highlighted?: boolean
  isDisabled?: boolean
  children?: React.ReactNode
}

type StyleProps = {
  highlighted: boolean
}

export const OptionRow: React.FC<OptionRowProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  valueColor,
  highlighted = false,
  isDisabled = false,
  children,
}) => {
  const styles = useStyles({ highlighted })
  const {
    theme: { colors },
  } = useTheme()

  const resolvedValueColor = valueColor ?? colors.textOnBackground
  const resolvedIconColor = isDisabled ? colors.textDisabled : iconColor
  const disabledText = isDisabled ? { color: colors.textDisabled } : null

  return (
    <View style={styles.container}>
      <GaloyIcon name={icon} size={16} color={resolvedIconColor} />
      <View style={styles.textContainer}>
        <Text style={[styles.title, disabledText]}>{title}</Text>
        <Text style={[styles.subtitle, disabledText]}>{subtitle}</Text>
        {value && (
          <Text style={[styles.value, { color: resolvedValueColor }]}>{value}</Text>
        )}
      </View>
      {children}
    </View>
  )
}

const useStyles = makeStyles(({ colors }, { highlighted }: StyleProps) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14,
    gap: 14,
    backgroundColor: highlighted ? colors.neutral : colors.surfaceInteractive,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.textOnBackground,
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  value: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
}))
