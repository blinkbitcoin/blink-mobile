import { useEffect, useRef, useState } from "react"
import {
  withSequence,
  withTiming,
  withSpring,
  Easing,
  type SharedValue,
} from "react-native-reanimated"

const BOUNCE_LOW = 0.88
const BOUNCE_PEAK = 1.22

export const bounceInAnimation = ({
  scale,
  duration,
  isSingleBounce = false,
  peak = BOUNCE_PEAK,
}: {
  scale: SharedValue<number>
  duration: number
  /** How far the bounce grows. */
  peak?: number
  /** Grows, shrinks and comes back to size once, each step `duration` long, where the
   *  default springs back from the peak and can wobble more than once. */
  isSingleBounce?: boolean
}) => {
  if (isSingleBounce) {
    const step = { duration, easing: Easing.inOut(Easing.quad) }
    scale.value = withSequence(
      withTiming(peak, step),
      withTiming(BOUNCE_LOW, step),
      withTiming(1, step),
    )
    return
  }
  scale.value = BOUNCE_LOW
  scale.value = withSequence(
    withTiming(peak, { duration, easing: Easing.out(Easing.quad) }),
    withSpring(1, { damping: 12, stiffness: 200 }),
  )
}

export const useBounceInAnimation = ({
  isFocused,
  visible,
  scale,
  delay,
  duration,
  isSingleBounce,
  peak,
}: {
  isFocused: boolean
  visible: boolean
  scale: SharedValue<number>
  delay: number
  duration: number
  isSingleBounce?: boolean
  peak?: number
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
        bounceInAnimation({ scale, duration, isSingleBounce, peak })
      }, delay)
    }

    prevFocused.current = isFocused
    prevVisible.current = visible

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [delay, duration, isFocused, isSingleBounce, peak, scale, visible])

  return rendered
}
