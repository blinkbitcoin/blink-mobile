import React, { useEffect } from "react"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import Svg, { ClipPath, Defs, G, Line, Path, Rect } from "react-native-svg"

const AnimatedRect = Animated.createAnimatedComponent(Rect)
const AnimatedLine = Animated.createAnimatedComponent(Line)

const VIEWBOX_SIZE = 32
const LOOP_MS = 4000

/** Figma HourglassLow outline with both chambers cut out; the sand is drawn on its own. */
const FRAME_PATH =
  "M7 22.545L7 27C7 27.5304 7.21071 28.0391 7.58579 28.4142C7.96086 28.7893 8.46957 29 9 29L23 29C23.5304 29 24.0391 28.7893 24.4142 28.4142C24.7893 28.0391 25 27.5304 25 27L25 22.5C24.9993 22.1896 24.9267 21.8836 24.7879 21.606C24.6491 21.3284 24.4479 21.0868 24.2 20.9L17.6663 16L24.2 11.1C24.4479 10.9132 24.6491 10.6716 24.7879 10.394C24.9267 10.1164 24.9993 9.81037 25 9.5L25 5C25 4.46957 24.7893 3.96086 24.4142 3.58579C24.0391 3.21072 23.5304 3 23 3L9 3C8.46957 3 7.96086 3.21072 7.58579 3.58579C7.21072 3.96086 7 4.46957 7 5L7 9.455C7.00081 9.76399 7.07285 10.0686 7.21051 10.3452C7.34817 10.6219 7.54775 10.863 7.79375 11.05L14.3413 16L7.79375 20.95C7.54754 21.1368 7.3478 21.3779 7.21012 21.6546C7.07243 21.9312 7.00053 22.236 7 22.545Z M23 9.455L16 14.75L9 9.5V5H23V9.455Z M9 22.545L16 17.25L23 22.5V27H9V22.545Z"
const TOP_CHAMBER = "M23 9.455L16 14.75L9 9.5V5H23V9.455Z"
const BOTTOM_CHAMBER = "M9 22.545L16 17.25L23 22.5V27H9V22.545Z"

/** Top sand line: y 8 (Figma start) down to the neck, where the chamber clip closes it. */
const TOP_FROM_Y = 8
const TOP_TRAVEL = 7
/** Bottom sand line: below the floor (clipped) up to y 22 (Figma end). */
const BOTTOM_FROM_Y = 27
const BOTTOM_TO_Y = 22
const STREAM_LENGTH = 6

const EASE_IN = Easing.bezierFn(0.42, 0, 1, 1)
const EASE_OUT = Easing.bezierFn(0, 0, 0.58, 1)
const EASE_TURN = Easing.bezierFn(0.65, 0, 0.35, 1)

/** Progress of `t` through [from, to] of the loop, clamped to 0..1. */
const phase = (t: number, from: number, to: number) => {
  "worklet"
  return Math.min(1, Math.max(0, (t - from) / (to - from)))
}

type PendingHourglassProps = {
  size: number
  color: string
}

/**
 * The pending on-chain icon, from Figma's start, progress and end states: the sand runs
 * from the top chamber to the bottom one, then the glass turns 180° clockwise. The end
 * state turned over is the start state, so the loop never jumps. Reduce motion holds the
 * start state.
 */
export const PendingHourglass: React.FC<PendingHourglassProps> = ({ size, color }) => {
  const reducedMotion = useReducedMotion()
  const loop = useSharedValue(0)

  useEffect(() => {
    if (reducedMotion) return
    loop.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
    )
    return () => cancelAnimation(loop)
  }, [reducedMotion, loop])

  const turnStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${180 * EASE_TURN(phase(loop.value, 0.82, 1))}deg` }],
  }))
  const topProps = useAnimatedProps(() => ({
    y: TOP_FROM_Y + TOP_TRAVEL * phase(loop.value, 0.08, 0.58),
  }))
  const streamProps = useAnimatedProps(() => {
    const t = loop.value
    const falling = EASE_IN(phase(t, 0.1, 0.2))
    const draining = EASE_IN(phase(t, 0.58, 0.68))
    return {
      strokeDashoffset: STREAM_LENGTH * (1 - falling) - STREAM_LENGTH * draining,
      strokeOpacity: t < 0.68 ? 1 : 0,
    }
  })
  const bottomProps = useAnimatedProps(() => ({
    y:
      BOTTOM_FROM_Y -
      (BOTTOM_FROM_Y - BOTTOM_TO_Y) * EASE_OUT(phase(loop.value, 0.22, 0.68)),
  }))

  return (
    <Animated.View style={[{ width: size, height: size }, turnStyle]}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        fill="none"
      >
        <Defs>
          <ClipPath id="pending-hourglass-top">
            <Path d={TOP_CHAMBER} />
          </ClipPath>
          <ClipPath id="pending-hourglass-bottom">
            <Path d={BOTTOM_CHAMBER} />
          </ClipPath>
        </Defs>
        <Path d={FRAME_PATH} fill={color} fillRule="evenodd" />
        <G clipPath="url(#pending-hourglass-top)">
          <AnimatedRect
            x={7}
            y={TOP_FROM_Y}
            width={18}
            height={2}
            fill={color}
            animatedProps={topProps}
          />
        </G>
        <G clipPath="url(#pending-hourglass-bottom)">
          <AnimatedLine
            x1={16}
            y1={16}
            x2={16}
            y2={16 + STREAM_LENGTH}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={[STREAM_LENGTH, STREAM_LENGTH]}
            strokeDashoffset={STREAM_LENGTH}
            animatedProps={streamProps}
          />
          <AnimatedRect
            x={7}
            y={BOTTOM_FROM_Y}
            width={18}
            height={2}
            fill={color}
            animatedProps={bottomProps}
          />
        </G>
      </Svg>
    </Animated.View>
  )
}
