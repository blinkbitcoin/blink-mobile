import React from "react"
import { View, Text as RNText, ViewStyle } from "react-native"
import { makeStyles } from "@rneui/themed"

type NotificationProps = {
  visible?: boolean
  text?: string
  size?: number
  top?: number
  right?: number
  style?: ViewStyle
  maxWidth?: number
}

export const NotificationBadge: React.FC<NotificationProps> = ({
  visible = false,
  text,
  size = 18,
  top = -6,
  right = -8,
  style,
  maxWidth = 48,
}) => {
  const styles = useStyles({ size, top, right, maxWidth })
  if (!visible) return null

  const hasText = typeof text === "string" && text.trim().length > 0

  if (!hasText) {
    return <View pointerEvents="none" style={[styles.dot, style]} />
  }

  return (
    <View pointerEvents="none" style={[styles.pill, style]}>
      <RNText numberOfLines={1} ellipsizeMode="tail" style={styles.pillText}>
        {text}
      </RNText>
    </View>
  )
}

const useStyles = makeStyles(
  (
    { colors },
    {
      size,
      top,
      right,
      maxWidth,
    }: { size: number; top: number; right: number; maxWidth: number },
  ) => ({
    dot: {
      position: "absolute",
      top,
      right,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.black,
      borderColor: colors.black,
      borderWidth: 1,
    },
    pill: {
      position: "absolute",
      top,
      right,
      minWidth: size,
      height: size,
      maxWidth,
      paddingHorizontal: 6,
      borderRadius: size / 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.black,
      borderColor: colors.black,
      borderWidth: 1,
    },
    pillText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: "700",
      includeFontPadding: false,
    },
  }),
)
