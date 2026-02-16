import { useCallback, useRef } from "react"
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated"

export const useAlternatingSpin = (duration = 200) => {
  const rotation = useSharedValue(0)
  const target = useRef(0)
  const direction = useRef(1)

  const triggerSpin = useCallback(() => {
    cancelAnimation(rotation)
    target.current += 360 * direction.current
    direction.current = -direction.current
    rotation.value = withTiming(target.current, {
      duration,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
    })
  }, [duration, rotation])

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return { triggerSpin, spinStyle }
}
