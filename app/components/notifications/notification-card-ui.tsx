import React from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { makeStyles, useTheme, Text } from "@rneui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"
import { GaloyIconButton } from "../atomic/galoy-icon-button"

export type NotificationCardUIProps = {
  title: string
  text: string
  icon?: IconNamesType
  action: () => Promise<void>
  loading?: boolean
  dismissAction?: () => void
}

export const NotificationCardUI: React.FC<NotificationCardUIProps> = ({
  title,
  text,
  icon,
  action,
  loading,
  dismissAction,
}) => {
  const iconName = icon || "pencil"
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  if (loading) {
    return (
      <TouchableOpacity style={styles.loadingButtonContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity style={styles.buttonContainer} onPress={action}>
      <View style={styles.viewHeader}>
        <View style={styles.leftIconContainer}>
          <GaloyIcon name={iconName} color={colors.primary} size={24} />
        </View>

        <Text type={"p1"} bold style={styles.titleStyle}>
          {title}
        </Text>
        <View style={styles.rightIconContainer}>
          <GaloyIconButton
            name="close"
            size={"small"}
            iconOnly={true}
            onPress={dismissAction}
          />
        </View>
      </View>
      <View style={styles.textContainer}>
        <Text type={"p2"}>{text}</Text>
      </View>
    </TouchableOpacity>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  buttonContainer: {
    padding: 12,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    minHeight: 100,
    columnGap: 15,
    flexDirection: "column",
  },
  titleStyle: {
    flex: 1,
  },
  leftIconContainer: {
    width: 40,
    justifyContent: "flex-start",
    flexDirection: "row",
  },
  rightIconContainer: {
    width: 40,
    justifyContent: "flex-end",
    flexDirection: "row",
  },
  viewHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingButtonContainer: {
    flexDirection: "column",
    padding: 12,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    minHeight: 100,
    columnGap: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flexGrow: 1,
    paddingHorizontal: 40,
  },
}))
