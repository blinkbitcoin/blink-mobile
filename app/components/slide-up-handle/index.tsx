import React, { useCallback } from "react"
import { Pressable, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Icon from "react-native-vector-icons/Ionicons"
import { makeStyles, useTheme } from "@rn-vui/themed"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

type PullUpHandleProps = {
  onPullUp: () => void
  bottomOffset?: number
}

type UseStylesProps = {
  bottomOffset: number
}

const DRAG_THRESHOLD = -120
const SPRING_BACK_MS = 100

export const SlideUpHandle: React.FC<PullUpHandleProps> = ({
  onPullUp,
  bottomOffset = 20,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles({ bottomOffset })

  const y = useSharedValue(0)
  const active = useSharedValue(0)
  const trigger = useCallback(() => onPullUp(), [onPullUp])

  const pan = Gesture.Pan()
    .hitSlop({ top: 12, bottom: 24, left: 40, right: 40 })
    .onBegin(() => {
      active.value = withTiming(1, { duration: 100 })
    })
    .onUpdate((e) => {
      y.value = Math.min(0, e.translationY)
    })
    .onEnd((e) => {
      const shouldOpen = y.value < DRAG_THRESHOLD || e.velocityY < -500
      if (shouldOpen) runOnJS(trigger)()

      y.value = withTiming(0, { duration: SPRING_BACK_MS })
    })
    .onFinalize(() => {
      active.value = withTiming(0, { duration: 120 })
    })

  const aTranslate = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value * 0.35 }],
  }))

  const aHighlight = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: 1 + active.value * 0.06 }],
  }))

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.pill, aTranslate]}>
          <Animated.View style={[styles.highlightBg, aHighlight]} />
          <Pressable
            hitSlop={12}
            onPress={() => trigger()}
            onPressIn={() => (active.value = withTiming(1, { duration: 80 }))}
            onPressOut={() => (active.value = withTiming(0, { duration: 120 }))}
            style={styles.press}
          >
            <Icon name="chevron-up-outline" size={18} color={colors.grey2} />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const useStyles = makeStyles(({ colors }, { bottomOffset }: UseStylesProps) => ({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: bottomOffset,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  pill: {
    height: 24,
    width: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  highlightBg: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 12,
    backgroundColor: colors.grey5,
    borderColor: colors.grey4,
    borderWidth: 1,
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  press: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
}))

export default SlideUpHandle
