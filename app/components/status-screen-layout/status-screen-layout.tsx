import React from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type StatusScreenLayoutProps = {
  icon: IconNamesType
  iconSize?: number
  iconBackgroundColor?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export const StatusScreenLayout: React.FC<StatusScreenLayoutProps> = ({
  icon,
  iconSize = 72,
  iconBackgroundColor,
  children,
  footer,
}) => {
  const styles = useStyles({ iconBackgroundColor })

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {iconBackgroundColor ? (
          <View style={styles.iconCircle}>
            <GaloyIcon name={icon} size={iconSize} />
          </View>
        ) : (
          <GaloyIcon name={icon} size={iconSize} />
        )}
        {children}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  )
}

type StyleProps = {
  iconBackgroundColor?: string
}

const useStyles = makeStyles((_theme, { iconBackgroundColor }: StyleProps) => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 26,
  },
  iconCircle: {
    padding: 10,
    borderRadius: 59,
    backgroundColor: iconBackgroundColor,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
