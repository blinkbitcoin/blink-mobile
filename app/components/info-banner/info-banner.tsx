import React from "react"
import { View } from "react-native"

import { Colors, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"

type InfoBannerProps = {
  children: React.ReactNode
  title?: string
  icon?: IconNamesType
  iconColor?: keyof Colors
  titleColor?: keyof Colors
}

export const InfoBanner: React.FC<InfoBannerProps> = ({
  children,
  title,
  icon,
  iconColor = "black",
  titleColor = "primary",
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.container}>
      {(icon || title) && (
        <View style={styles.header}>
          {icon && <GaloyIcon name={icon} size={20} color={String(colors[iconColor])} />}
          {title && (
            <Text style={[styles.title, { color: String(colors[titleColor]) }]}>
              {title}
            </Text>
          )}
        </View>
      )}
      <Text style={styles.description}>{children}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  description: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
    color: colors.grey2,
  },
}))
