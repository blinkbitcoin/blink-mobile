import { useEffect, useRef } from "react"
import { Animated, Easing } from "react-native"

type DropInOutAnimationParams = {
  visible?: boolean
  delay?: number
  distance?: number
  durationIn?: number
  durationOut?: number
  overshoot?: number
  springStiffness?: number
  springDamping?: number
  springVelocity?: number
  reverseExit?: boolean
  onExitComplete?: () => void
}

export const useDropInOutAnimation = ({
  visible = true,
  delay = 0,
  distance = 56,
  durationIn = 180,
  durationOut = 180,
  overshoot = 5,
  springStiffness = 200,
  springDamping = 18,
  springVelocity = 0.4,
  reverseExit = false,
  onExitComplete,
}: DropInOutAnimationParams = {}) => {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-distance)).current
  const wasVisible = useRef(false)

  useEffect(() => {
    opacity.stopAnimation()
    translateY.stopAnimation()

    if (!visible) {
      if (wasVisible.current) {
        const exitTarget = reverseExit ? distance : -distance
        const exitAnim = Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: durationOut,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: exitTarget,
            duration: durationOut,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])

        exitAnim.start(({ finished }) => {
          if (finished && onExitComplete) onExitComplete()
        })
      } else {
        opacity.setValue(0)
        translateY.setValue(-distance)
      }
      wasVisible.current = false
      return
    }

    opacity.setValue(0)
    translateY.setValue(-distance)

    const entryAnim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Math.round(durationIn * 0.8),
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: overshoot,
          duration: durationIn,
          delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          stiffness: springStiffness,
          damping: springDamping,
          mass: 0.6,
          velocity: springVelocity,
          useNativeDriver: true,
        }),
      ]),
    ])

    entryAnim.start(() => {
      wasVisible.current = true
    })
    return () => entryAnim.stop()
  }, [
    visible,
    delay,
    distance,
    durationIn,
    durationOut,
    overshoot,
    springStiffness,
    springDamping,
    springVelocity,
    reverseExit,
    onExitComplete,
    opacity,
    translateY,
  ])

  return { opacity, translateY }
}
