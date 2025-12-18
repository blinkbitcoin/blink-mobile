import React, { useState, useEffect } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import Icon from "react-native-vector-icons/Ionicons"
import { makeStyles, useTheme } from "@rn-vui/themed"

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
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setIsLoading(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  const gesture = Gesture.Pan()
    .enabled(!disabled && !isLoading)
    .onStart(() => {
      runOnJS(setIsLoading)(false)
      isActive.value = withTiming(1, { duration: 100 })
    })
    .onUpdate((event) => {
      if (event.translationY >= 0) {
        dragDistance.value = 0
        return
      }

      const distance = Math.abs(event.translationY)
      dragDistance.value = Math.min(distance, MAX_SWIPE_DISTANCE)
    })
    .onEnd((event) => {
      const isSwipingUp = event.translationY < 0
      const isFullSwipe =
        isSwipingUp &&
        dragDistance.value >= MAX_SWIPE_DISTANCE - SWIPE_COMPLETION_TOLERANCE

      if (isFullSwipe) {
        runOnJS(setIsLoading)(true)
        runOnJS(onAction)()
      }

      dragDistance.value = withSpring(0)
      isActive.value = withTiming(0, { duration: 120 })
    })

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isActive.value,
  }))

  const progressBarStyle = useAnimatedStyle(() => {
    const progress = isLoading ? 1 : dragDistance.value / MAX_SWIPE_DISTANCE
    return {
      height: interpolate(progress, [0, 1], [0, 64], Extrapolation.CLAMP),
    }
  })

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -dragDistance.value * 0.35 },
      { scale: interpolate(isActive.value, [0, 1], [1, 1.06], Extrapolation.CLAMP) },
    ],
  }))

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <GestureDetector gesture={gesture}>
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
            disabled={disabled || isLoading}
            onPress={() => {
              if (disabled || isLoading) return
              setIsLoading(true)
              onAction()
            }}
            style={styles.iconPressable}
          >
            <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Icon name="chevron-up-outline" size={18} color={colors.black} />
              )}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
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
      width: "90%",
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
