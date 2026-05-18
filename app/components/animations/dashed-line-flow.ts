import { useEffect } from "react"
import {
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

  useEffect(() => {
    dashOffset.value = withRepeat(
      withTiming(-totalOffset, { duration, easing: Easing.linear }),
      -1,
      false,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }))

  const dashArray = `${dashLength} ${gapLength}`

  return { animatedProps, dashArray }
}
