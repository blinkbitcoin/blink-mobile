import { useEffect, useRef } from "react"
import { Animated, Easing } from "react-native"

type DropInAnimationParams = {
  visible?: boolean
  delay?: number
  distance?: number
  durationIn?: number
  overshoot?: number
  springStiffness?: number
  springDamping?: number
  springVelocity?: number
}

export const useDropInAnimation = ({
  visible = true,
  delay = 0,
  distance = 56,
  durationIn = 180,
  overshoot = 5,
  springStiffness = 200,
  springDamping = 18,
  springVelocity = 0.4,
}: DropInAnimationParams = {}) => {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-distance)).current

  useEffect(() => {
    opacity.stopAnimation()
    translateY.stopAnimation()

    if (!visible) {
      opacity.setValue(0)
      translateY.setValue(-distance)
      return
    }

    opacity.setValue(0)
    translateY.setValue(-distance)

    const anim = Animated.parallel([
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

    anim.start()
    return () => anim.stop()
  }, [
    visible,
    delay,
    distance,
    durationIn,
    overshoot,
    springStiffness,
    springDamping,
    springVelocity,
    opacity,
    translateY,
  ])

  return { opacity, translateY }
}
