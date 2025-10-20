import { useEffect, useRef, useState } from "react"
import {
  withSequence,
  withTiming,
  withSpring,
  Easing,
  type SharedValue,
} from "react-native-reanimated"

export const bounceInAnimation = ({
  scale,
  duration,
}: {
  scale: SharedValue<number>
  duration: number
}) => {
  scale.value = 0.88
  scale.value = withSequence(
    withTiming(1.22, { duration, easing: Easing.out(Easing.quad) }),
    withSpring(1, { damping: 12, stiffness: 200 }),
  )
}

export const useBounceInAnimation = ({
  isFocused,
  visible,
  scale,
  delay,
  duration,
}: {
  isFocused: boolean
  visible: boolean
  scale: SharedValue<number>
  delay: number
  duration: number
}) => {
  const [rendered, setRendered] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevFocused = useRef(false)
  const prevVisible = useRef(false)

  useEffect(() => {
    const screenJustFocused = !prevFocused.current && isFocused
    const visibilityJustEnabled = !prevVisible.current && visible
    const shouldStartBounce =
      isFocused && visible && (screenJustFocused || visibilityJustEnabled)

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!isFocused || !visible) {
      setRendered(false)
      scale.value = 1
    }

    if (shouldStartBounce) {
      setRendered(false)
      timerRef.current = setTimeout(() => {
        setRendered(true)
        bounceInAnimation({ scale, duration })
      }, delay)
    }

    prevFocused.current = isFocused
    prevVisible.current = visible

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [delay, duration, isFocused, scale, visible])

  return rendered
}
