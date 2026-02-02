import React from "react"
import { View } from "react-native"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type BaseInfoCardProps = {
  title: string
  icon?: IconNamesType
  ionicon?: string
  titleColor?: string
  iconColor?: string
}

type WithDescription = BaseInfoCardProps & {
  description: string
  customDescription?: never
}

type WithCustomDescription = BaseInfoCardProps & {
  description?: never
  customDescription: React.ReactNode
}

type InfoCardProps = WithDescription | WithCustomDescription

export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  icon = "warning",
  ionicon,
  titleColor,
  iconColor,
  ...rest
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const resolvedTitleColor = titleColor ?? colors.warning
  const resolvedIconColor = iconColor ?? colors.warning
  const styles = useStyles({ titleColor: resolvedTitleColor })

  const renderIcon = () => {
    if (ionicon) {
      return <Icon name={ionicon} type="ionicon" size={16} color={resolvedIconColor} />
    }
    return <GaloyIcon name={icon} size={16} color={resolvedIconColor} />
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {renderIcon()}
        <Text style={styles.title}>{title}</Text>
      </View>
      {rest.customDescription ? (
        rest.customDescription
      ) : (
        <Text style={styles.description}>{rest.description}</Text>
      )}
    </View>
  )
}

type StyleProps = {
  titleColor: string
}

const useStyles = makeStyles(({ colors }, { titleColor }: StyleProps) => ({
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
    paddingVertical: 3,
  },
  title: {
    color: titleColor,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 22,
  },
  description: {
    color: colors.grey2,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 16,
  },
}))
