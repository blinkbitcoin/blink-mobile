import React from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"

type StatusScreenLayoutProps = {
  icon: IconNamesType
  iconSize?: number
  iconColor?: string
  iconPadding?: number
  iconBackgroundColor?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export const StatusScreenLayout: React.FC<StatusScreenLayoutProps> = ({
  icon,
  iconSize = 72,
  iconColor,
  iconPadding = 10,
  iconBackgroundColor = "transparent",
  children,
  footer,
}) => {
  const styles = useStyles({ iconBackgroundColor, iconPadding })

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <GaloyIcon name={icon} size={iconSize} color={iconColor} />
        </View>
        {children}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  )
}

type StyleProps = {
  iconBackgroundColor: string
  iconPadding: number
}

const useStyles = makeStyles(
  (_theme, { iconBackgroundColor, iconPadding }: StyleProps) => ({
    container: {
      flex: 1,
      justifyContent: "space-between",
    },
    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
      gap: 26,
    },
    iconCircle: {
      padding: iconPadding,
      borderRadius: 59,
      backgroundColor: iconBackgroundColor,
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      paddingTop: 10,
    },
  }),
)
