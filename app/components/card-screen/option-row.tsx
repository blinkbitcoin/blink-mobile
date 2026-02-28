import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type OptionRowProps = {
  icon: IconNamesType
  iconColor: string
  title: string
  subtitle: string
  value?: string
  valueColor?: string
  highlighted?: boolean
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
  children,
}) => {
  const styles = useStyles({ highlighted })
  const {
    theme: { colors },
  } = useTheme()

  const resolvedValueColor = valueColor ?? colors.black

  return (
    <View style={styles.container}>
      <GaloyIcon name={icon} size={16} color={iconColor} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
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
    backgroundColor: highlighted ? colors.grey4 : colors.grey5,
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
