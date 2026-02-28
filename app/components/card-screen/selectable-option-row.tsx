import React from "react"
import { Pressable, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type SelectableOptionRowProps = {
  icon: IconNamesType
  iconColor: string
  title: string
  subtitle: string
  value?: string
  valueColor?: string
  isSelected: boolean
  onPress: () => void
}

export const SelectableOptionRow: React.FC<SelectableOptionRowProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  valueColor,
  isSelected,
  onPress,
}) => {
  const styles = useStyles({ isSelected })
  const {
    theme: { colors },
  } = useTheme()

  const resolvedValueColor = valueColor ?? colors.black

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
    >
      <GaloyIcon name={icon} size={16} color={iconColor} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {value && (
          <Text style={[styles.value, { color: resolvedValueColor }]}>{value}</Text>
        )}
      </View>
      <GaloyIcon name="caret-right" size={16} color={colors.primary} />
    </Pressable>
  )
}

type StyleProps = {
  isSelected: boolean
}

const useStyles = makeStyles(({ colors }, { isSelected }: StyleProps) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14,
    gap: 14,
    backgroundColor: isSelected ? colors.grey4 : colors.transparent,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  subtitle: {
    color: colors.grey2,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  value: {
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
}))
