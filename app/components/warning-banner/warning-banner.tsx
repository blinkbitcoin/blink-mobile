import React from "react"
import { View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useAccessibilityAnnouncement } from "@app/hooks/use-accessibility-announcement"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

export type WarningBannerProps = {
  children: React.ReactNode
  numberOfLines?: number
  /** Speaks the warning as it appears, for one that shows without moving focus. Off by
   *  default, since a screen that opens with a warning is already read. */
  announce?: boolean
}

export const WarningBanner: React.FC<WarningBannerProps> = ({
  children,
  numberOfLines,
  announce = false,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  useAccessibilityAnnouncement(
    announce && typeof children === "string" ? children : undefined,
  )

  return (
    <View style={styles.container}>
      <GaloyIcon name="warning" size={18} color={colors.warning} />
      <Text
        type="p3"
        style={styles.text}
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
      >
        {children}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 4,
  },
  text: {
    color: colors.warning,
    flex: 1,
  },
}))
