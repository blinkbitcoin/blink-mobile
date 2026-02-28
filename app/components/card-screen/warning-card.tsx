import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type BaseWarningCardProps = {
  title: string
  icon?: IconNamesType
}

type WithDescription = BaseWarningCardProps & {
  description: string
  customDescription?: never
}

type WithCustomDescription = BaseWarningCardProps & {
  description?: never
  customDescription: React.ReactNode
}

type WarningCardProps = WithDescription | WithCustomDescription

export const WarningCard: React.FC<WarningCardProps> = ({
  title,
  icon = "warning",
  ...rest
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <GaloyIcon name={icon} size={16} color={colors.warning} />
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

const useStyles = makeStyles(({ colors }) => ({
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
    color: colors.warning,
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
