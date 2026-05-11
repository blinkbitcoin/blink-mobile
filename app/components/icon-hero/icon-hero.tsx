import React from "react"
import { View } from "react-native"

import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type IconHeroProps = {
  icon: IconNamesType
  iconColor?: string
  title: string
  subtitle?: string
}

export const IconHero: React.FC<IconHeroProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <GaloyIcon name={icon} size={34} color={iconColor ?? colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    alignItems: "center",
    gap: 20,
    paddingVertical: 20,
  },
  iconContainer: {
    backgroundColor: colors.grey5,
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
    color: colors.black,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
    color: colors.black,
    textAlign: "center",
    maxWidth: 264,
  },
}))
