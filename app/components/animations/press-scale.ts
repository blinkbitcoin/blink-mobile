import { useCallback, useRef } from "react"
import { Animated, Easing } from "react-native"

export const usePressScale = (scaleDown = 0.95, durationIn = 200, durationOut = 100) => {
  const scaleValue = useRef(new Animated.Value(1)).current

  const pressIn = useCallback(() => {
    Animated.timing(scaleValue, {
      toValue: scaleDown,
      duration: durationIn,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.quad),
    }).start()
  }, [scaleValue, scaleDown, durationIn])

  const pressOut = useCallback(() => {
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: durationOut,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.quad),
    }).start()
  }, [scaleValue, durationOut])

  return { scaleValue, pressIn, pressOut }
}
