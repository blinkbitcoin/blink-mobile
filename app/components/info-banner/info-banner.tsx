import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

const BannerVariant = {
  Info: "info",
  Warning: "warning",
} as const

type BannerVariant = (typeof BannerVariant)[keyof typeof BannerVariant]

type InfoBannerProps = {
  children: React.ReactNode
  variant?: BannerVariant
  title?: string
  icon?: IconNamesType
}

export const InfoBanner: React.FC<InfoBannerProps> = ({
  children,
  variant = BannerVariant.Info,
  title,
  icon,
}) => {
  const isWarning = variant === BannerVariant.Warning
  const styles = useStyles({ isWarning })
  const {
    theme: { colors },
  } = useTheme()

  const iconColor = isWarning ? colors._orange : colors.primary

  return (
    <View style={styles.container}>
      {(icon || title) && (
        <View style={styles.header}>
          {icon && <GaloyIcon name={icon} size={16} color={iconColor} />}
          {title && <Text style={styles.title}>{title}</Text>}
        </View>
      )}
      {children}
    </View>
  )
}

export { BannerVariant }

type StyleParams = { isWarning: boolean }

const useStyles = makeStyles(({ colors }, { isWarning }: StyleParams) => ({
  container: {
    backgroundColor: colors.grey5,
    borderLeftWidth: 2,
    borderLeftColor: isWarning ? colors._orange : colors.black,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  title: {
    fontWeight: "700",
    fontSize: 13,
    color: isWarning ? colors._orange : colors.black,
  },
}))
