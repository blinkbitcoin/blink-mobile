import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"

const ICON_FRAME_SIZE = 44

type IconHeroProps = {
  icon: IconNamesType
  iconColor: string
  /** A plain heading, or the caller's own nodes when the heading is animated or sized by
   *  the screen (the send flow's amounts). */
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** A line above the title: what the hero is about, where the title is a value. */
  caption?: React.ReactNode
  /**
   * Caps the title, for a screen whose title is one unbreakable thing — a lightning
   * address — rather than a sentence. Left open otherwise, so a heading still wraps.
   */
  titleLines?: number
  /** Glyph size inside the 44 frame. */
  iconSize?: number
  /** The grey disc behind the glyph. Off leaves the glyph on the screen's own ground. */
  hasIconBackground?: boolean
  /** Tightens the hero for a screen that leads with it rather than opening on it: no top
   *  padding, and the column runs the full width so a long value can use it. */
  compact?: boolean
}

export const IconHero: React.FC<IconHeroProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  caption,
  titleLines,
  iconSize = 34,
  hasIconBackground = true,
  compact = false,
}) => {
  const styles = useStyles()

  const isPlainTextTitle = typeof title === "string"
  const isPlainTextSubtitle = typeof subtitle === "string"
  /** An empty string skips the subtitle Text entirely, so it never adds a blank line. */
  const hasVisibleTextSubtitle = isPlainTextSubtitle && subtitle.length > 0

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.iconContainer, hasIconBackground && styles.iconBackground]}>
        <GaloyIcon name={icon} size={iconSize} color={iconColor} />
      </View>
      <View style={[styles.textContainer, compact && styles.textContainerCompact]}>
        {caption}
        {isPlainTextTitle ? (
          <Text style={styles.title} numberOfLines={titleLines} ellipsizeMode="middle">
            {title}
          </Text>
        ) : (
          title
        )}
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
  containerCompact: {
    paddingTop: 0,
    paddingHorizontal: 0,
    gap: 10,
  },
  iconContainer: {
    width: ICON_FRAME_SIZE,
    height: ICON_FRAME_SIZE,
    borderRadius: ICON_FRAME_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBackground: {
    backgroundColor: colors.grey5,
  },
  textContainer: {
    alignItems: "center",
    gap: 8,
  },
  textContainerCompact: {
    alignSelf: "stretch",
    gap: 5,
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
