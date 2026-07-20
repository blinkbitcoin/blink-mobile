import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"

type IconHeroProps = {
  icon: IconNamesType
  iconColor: string
  title: string
  subtitle?: React.ReactNode
}

export const IconHero: React.FC<IconHeroProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
}) => {
  const styles = useStyles()

  const isPlainTextSubtitle = typeof subtitle === "string"
  /** An empty string skips the subtitle Text entirely, so it never adds a blank line. */
  const hasVisibleTextSubtitle = isPlainTextSubtitle && subtitle.length > 0

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <GaloyIcon name={icon} size={34} color={iconColor} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {hasVisibleTextSubtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {isPlainTextSubtitle ? null : subtitle}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    alignItems: "center",
    paddingTop: 20,
    paddingHorizontal: 40,
    gap: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
}))
