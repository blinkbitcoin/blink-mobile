import React from "react"
import { Dimensions, View, Pressable } from "react-native"
import { PanGestureHandler } from "react-native-gesture-handler"
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import Icon from "react-native-vector-icons/Ionicons"
import { makeStyles, useTheme } from "@rn-vui/themed"

const SCREEN_WIDTH = Dimensions.get("screen").width
const TOUCH_AREA_HEIGHT = 82
const MAX_SWIPE_DISTANCE = 80
const SWIPE_COMPLETION_TOLERANCE = 5

type SlideUpHandleProps = {
  onAction: () => void
  bottomOffset?: number
  disabled?: boolean
}

const SlideUpHandle: React.FC<SlideUpHandleProps> = ({
  onAction,
  bottomOffset = 20,
  disabled = false,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles({ bottomOffset })

  const dragDistance = useSharedValue(0)
  const isActive = useSharedValue(0)

  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      if (disabled) return
      isActive.value = withTiming(1, { duration: 100 })
    },
    onActive: (event) => {
      if (disabled) return
      if (event.translationY >= 0) {
        dragDistance.value = 0
        return
      }

      const distance = Math.abs(event.translationY)
      dragDistance.value = Math.min(distance, MAX_SWIPE_DISTANCE)
    },
    onEnd: (event) => {
      if (disabled) {
        dragDistance.value = withSpring(0)
        isActive.value = withTiming(0, { duration: 120 })
        return
      }

      const isSwipingUp = event.translationY < 0
      const isFullSwipe =
        isSwipingUp &&
        dragDistance.value >= MAX_SWIPE_DISTANCE - SWIPE_COMPLETION_TOLERANCE

      if (isFullSwipe) {
        runOnJS(onAction)()
      }

      dragDistance.value = withSpring(0)
      isActive.value = withTiming(0, { duration: 120 })
    },
    onCancel: () => {
      dragDistance.value = withSpring(0)
      isActive.value = withTiming(0, { duration: 120 })
    },
    onFail: () => {
      dragDistance.value = withSpring(0)
      isActive.value = withTiming(0, { duration: 120 })
    },
  })

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isActive.value,
  }))

  const progressBarStyle = useAnimatedStyle(() => {
    const progress = dragDistance.value / MAX_SWIPE_DISTANCE
    return {
      height: interpolate(progress, [0, 1], [0, 64], Extrapolate.CLAMP),
    }
  })

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -dragDistance.value * 0.35 },
      { scale: interpolate(isActive.value, [0, 1], [1, 1.06], Extrapolate.CLAMP) },
    ],
  }))

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <PanGestureHandler enabled={!disabled} onGestureEvent={gestureHandler}>
        <Animated.View style={styles.touchArea}>
          <Animated.View style={[styles.progressContainer, containerAnimatedStyle]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: colors.grey3 },
                progressBarStyle,
              ]}
            />
          </Animated.View>
          <Pressable
            disabled={disabled}
            onPress={() => {
              if (!disabled) onAction()
            }}
            style={styles.iconPressable}
          >
            <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
              <Icon name="chevron-up-outline" size={18} color={colors.black} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </PanGestureHandler>
    </View>
  )
}

const useStyles = makeStyles(
  ({ colors }, { bottomOffset }: { bottomOffset: number }) => ({
    overlay: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: bottomOffset,
      alignItems: "center",
      justifyContent: "center",
    },
    touchArea: {
      width: SCREEN_WIDTH - 40,
      height: TOUCH_AREA_HEIGHT,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    progressContainer: {
      position: "absolute",
      bottom: 10,
      width: 46,
      height: 64,
      borderRadius: 23,
      backgroundColor: colors.grey5,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    progressFill: {
      width: "100%",
      borderRadius: 23,
    },
    iconPressable: {
      marginBottom: 4,
    },
    iconContainer: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
  }),
)

export default SlideUpHandle
