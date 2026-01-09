import React from "react"
import { makeStyles, Text } from "@rn-vui/themed"
import { StyleProp, View, ViewStyle } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"

type ErrorBannerProps = {
  message?: string | null
  containerStyle?: StyleProp<ViewStyle>
  reserveSpace?: boolean
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  containerStyle,
  reserveSpace = true,
}) => {
  const styles = useStyles()
  const show = Boolean(message && String(message).trim().length > 0)
  const wrapperStyle = [
    styles.wrapper,
    reserveSpace && styles.fixedHeight,
    containerStyle,
  ]

  if (!show) return <View style={wrapperStyle} />

  return (
    <View style={wrapperStyle} accessibilityRole="alert">
      <View style={styles.inner}>
        <GaloyIcon color={styles.iconColor.color} name="warning" size={20} />
        <Text color={styles.textColor.color} type="p3">
          {message}
        </Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  wrapper: {
    marginTop: 8,
  },
  fixedHeight: {
    height: 44,
  },
  inner: {
    minHeight: 44,
    alignItems: "center",
    backgroundColor: colors.error9,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 6,
  },
  iconColor: { color: colors._white },
  textColor: { color: colors._white },
}))
