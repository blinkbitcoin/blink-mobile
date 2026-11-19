import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"
import { iconButtonSizes } from "../atomic/galoy-icon-button"

type IconHeroProps = {
  icon: IconNamesType
  iconColor: string
  title: string
  subtitle?: React.ReactNode
  /**
   * Caps the title, for a screen whose title is one unbreakable thing — a lightning
   * address — rather than a sentence. Left open otherwise, so a heading still wraps.
   */
  titleLines?: number
}

export const IconHero: React.FC<IconHeroProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  titleLines,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const isPlainTextSubtitle = typeof subtitle === "string"
  /** An empty string skips the subtitle Text entirely, so it never adds a blank line. */
  const hasVisibleTextSubtitle = isPlainTextSubtitle && subtitle.length > 0

  return (
    <View style={styles.container}>
      {/* Figma draws a large icon button here; it is drawn at that size, not as a
          button, so screen readers don't stop on a decoration. */}
      <GaloyIcon
        name={icon}
        size={iconButtonSizes.large.icon}
        containerSize={iconButtonSizes.large.circle}
        color={iconColor}
        backgroundColor={colors.surfaceInteractive}
      />
      <View style={styles.textContainer}>
        <Text bold style={styles.title} numberOfLines={titleLines} ellipsizeMode="middle">
          {title}
        </Text>
        {hasVisibleTextSubtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {isPlainTextSubtitle ? null : subtitle}
      </View>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    alignItems: "center",
    paddingTop: 20,
    paddingHorizontal: 40,
    gap: 14,
  },
  textContainer: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    textAlign: "center",
    width: "100%",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
}))
