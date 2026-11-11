import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

export type FeatureRowProps = {
  icon: IconNamesType
  title: string
  subtitle?: string
  badge?: string
}

const ICON_SIZE = 17
const ICON_CONTAINER_SIZE = 26

export const FeatureRow: React.FC<FeatureRowProps> = ({
  icon,
  title,
  subtitle,
  badge,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const hasSubtitle = Boolean(subtitle)
  const hasBadge = Boolean(badge)

  return (
    <View style={styles.row}>
      <GaloyIcon
        name={icon}
        color={colors._black}
        backgroundColor={colors.primary}
        size={ICON_SIZE}
        containerSize={ICON_CONTAINER_SIZE}
      />
      <View style={styles.textContainer}>
        <Text type="p2">{title}</Text>
        {hasSubtitle && (
          <Text type="p3" color={colors.grey2}>
            {subtitle}
          </Text>
        )}
      </View>
      {hasBadge && (
        <View style={styles.badge}>
          <Text bold style={styles.badgeText}>
            {badge}
          </Text>
        </View>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
  },
  textContainer: {
    flex: 1,
    minHeight: 36,
    justifyContent: "center",
  },
  badge: {
    backgroundColor: colors.grey4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 13,
    color: colors.grey1,
  },
}))
