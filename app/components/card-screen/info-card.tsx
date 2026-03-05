import React from "react"
import { View } from "react-native"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

const InfoCardSize = {
  Default: "default",
  Lg: "lg",
} as const

type InfoCardSizeType = (typeof InfoCardSize)[keyof typeof InfoCardSize]

type InfoCardProps = {
  title: string
  description?: string
  customDescription?: React.ReactNode
  icon?: IconNamesType
  ionicon?: string
  titleColor?: string
  iconColor?: string
  bulletItems?: string[]
  size?: InfoCardSizeType
  showIcon?: boolean
  bulletSpacing?: number
}

export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  description,
  customDescription,
  icon = "warning",
  ionicon,
  titleColor,
  iconColor,
  bulletItems,
  size = InfoCardSize.Default,
  showIcon = true,
  bulletSpacing = 0,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const resolvedTitleColor = titleColor ?? (showIcon ? colors.warning : colors.black)
  const resolvedIconColor = iconColor ?? colors.warning
  const isLg = size === InfoCardSize.Lg
  const styles = useStyles({ titleColor: resolvedTitleColor, isLg, bulletSpacing })

  const renderIcon = () => {
    if (ionicon) {
      return <Icon name={ionicon} type="ionicon" size={16} color={resolvedIconColor} />
    }
    return <GaloyIcon name={icon} size={16} color={resolvedIconColor} />
  }

  const renderBulletItems = () => {
    if (!bulletItems || bulletItems.length === 0) return null
    return (
      <View style={styles.bulletList}>
        {bulletItems.map((item) => (
          <View key={item} style={styles.bulletItem}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    )
  }

  const hasBody =
    Boolean(description) ||
    Boolean(customDescription) ||
    (bulletItems && bulletItems.length > 0)

  return (
    <View style={styles.container}>
      {showIcon ? (
        <View style={styles.header}>
          {renderIcon()}
          <Text style={styles.title}>{title}</Text>
        </View>
      ) : (
        <Text style={styles.standaloneTitle}>{title}</Text>
      )}
      {hasBody && (
        <View style={styles.body}>
          {customDescription ? (
            customDescription
          ) : description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
          {renderBulletItems()}
        </View>
      )}
    </View>
  )
}

type StyleProps = {
  titleColor: string
  isLg: boolean
  bulletSpacing: number
}

const useStyles = makeStyles(
  ({ colors }, { titleColor, isLg, bulletSpacing }: StyleProps) => ({
    container: {
      backgroundColor: colors.grey5,
      borderRadius: 8,
      padding: 14,
      gap: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
    },
    title: {
      color: titleColor,
      fontSize: 16,
      fontFamily: "Source Sans Pro",
      fontWeight: "700",
      lineHeight: 22,
    },
    standaloneTitle: {
      color: titleColor,
      fontSize: 16,
      fontFamily: "Source Sans Pro",
      fontWeight: "700",
      lineHeight: 22,
      paddingBottom: 5,
    },
    body: {
      gap: isLg ? 2 : 10,
    },
    description: {
      color: colors.grey2,
      fontSize: isLg ? 16 : 14,
      fontFamily: "Source Sans Pro",
      fontWeight: "400",
      lineHeight: isLg ? 22 : 16,
    },
    bulletList: {
      marginTop: isLg ? 0 : 4,
      marginLeft: 11,
      gap: bulletSpacing,
    },
    bulletItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    bullet: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.grey2,
      marginTop: isLg ? 9 : 6,
    },
    bulletText: {
      flex: 1,
      color: colors.grey2,
      fontSize: isLg ? 16 : 14,
      fontFamily: "Source Sans Pro",
      fontWeight: "400",
      lineHeight: isLg ? 24 : 16,
    },
  }),
)
