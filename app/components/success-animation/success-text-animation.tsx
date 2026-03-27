import React from "react"
import Animated, { runOnJS, ZoomInEasyUp } from "react-native-reanimated"

import { ANIMATION_DELAY, ANIMATION_DURATION } from "./config"

type Props = {
  children: React.ReactNode
  onComplete?: () => void
}

export const CompletedTextAnimation: React.FC<Props> = ({ children, onComplete }) => {
  const base = ZoomInEasyUp.duration(ANIMATION_DURATION)
    .springify()
    .delay(ANIMATION_DELAY)

  const entering = onComplete
    ? base.withCallback((finished) => {
        "worklet"
        if (finished && onComplete) runOnJS(onComplete)()
      })
    : base

  return <Animated.View entering={entering}>{children}</Animated.View>
}
