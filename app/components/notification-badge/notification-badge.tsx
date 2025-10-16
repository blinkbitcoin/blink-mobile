import React from "react"
import { Text as RNText, ViewStyle } from "react-native"
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated"
import { makeStyles } from "@rn-vui/themed"
import { useIsFocused } from "@react-navigation/native"

import { useBounceInAnimation } from "./bounce-in-animation"

type NotificationProps = {
  visible?: boolean
  text?: string
  size?: number
  top?: number
  right?: number
  style?: ViewStyle
  maxWidth?: number
}

const BOUNCE_DELAY = 300
const BOUNCE_DURATION = 120

export const NotificationBadge: React.FC<NotificationProps> = ({
  visible = false,
  text,
  size = 12,
  top = -5,
  right = -4,
  style,
  maxWidth = 48,
}) => {
  const styles = useStyles({ size, top, right, maxWidth })
  const isFocused = useIsFocused()
  const scale = useSharedValue(1)
  const rendered = useBounceInAnimation({
    isFocused,
    visible,
    scale,
    delay: BOUNCE_DELAY,
    duration: BOUNCE_DURATION,
  })

  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }] }),
    [scale],
  )

  if (!rendered) return null
  const hasText = typeof text === "string" && text.trim().length > 0

  if (!hasText) {
    return (
      <Animated.View pointerEvents="none" style={[styles.dot, animatedStyle, style]} />
    )
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.pill, animatedStyle, style]}>
      <RNText numberOfLines={1} ellipsizeMode="tail" style={styles.pillText}>
        {text}
      </RNText>
    </Animated.View>
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
