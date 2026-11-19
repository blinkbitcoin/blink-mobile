import { useEffect } from "react"
import {
  cancelAnimation,
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated"

type DashedLineFlowParams = {
  dashLength?: number
  gapLength?: number
  duration?: number
}

export const useDashedLineFlow = ({
  dashLength = 5,
  gapLength = 5,
  duration = 60000,
}: DashedLineFlowParams = {}) => {
  const patternLength = dashLength + gapLength
  const totalOffset = patternLength * 100

  const dashOffset = useSharedValue(0)

  /** The flow never ends on its own, so it is cancelled when its screen goes away rather
   *  than left running on the UI thread. */
  useEffect(() => {
    dashOffset.value = withRepeat(
      withTiming(-totalOffset, { duration, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(dashOffset)
  }, [dashOffset, totalOffset, duration])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }))

  const dashArray = `${dashLength} ${gapLength}`

  return { animatedProps, dashArray }
}
