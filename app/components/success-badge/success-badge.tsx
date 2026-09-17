import React, { useEffect } from "react"
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"
import { useTheme } from "@rn-vui/themed"

const AnimatedPath = Animated.createAnimatedComponent(Path)

const VIEWBOX_SIZE = 49
const STROKE_WIDTH = 3.00321

const BADGE_PATH =
  "M8.22048 40.6011C6.19392 38.5745 7.53761 34.3232 6.5023 31.834C5.467 29.3448 1.50195 27.1641 1.50195 24.4106C1.50195 21.657 5.42293 19.5644 6.5023 16.9871C7.58168 14.4098 6.19392 10.2466 8.22048 8.21999C10.2471 6.19343 14.4984 7.53713 16.9876 6.50181C19.4768 5.46651 21.6575 1.50146 24.411 1.50146C27.1646 1.50146 29.2572 5.42244 31.8345 6.50181C34.4118 7.58119 38.575 6.19343 40.6016 8.21999C42.6282 10.2466 41.2844 14.4979 42.3199 16.9871C43.3551 19.4763 47.3201 21.657 47.3201 24.4106C47.3201 27.1641 43.3991 29.2568 42.3199 31.834C41.2405 34.4113 42.6282 38.5745 40.6016 40.6011C38.575 42.6277 34.3237 41.2839 31.8345 42.3194C29.3453 43.3547 27.1646 47.3197 24.411 47.3197C21.6575 47.3197 19.5649 43.3986 16.9876 42.3194C14.4103 41.24 10.2471 42.6277 8.22048 40.6011Z"
/** Short arm first, the way a check is written by hand. The source SVG runs it backwards. */
const CHECK_PATH = "M14.7188 25.2918L21.1731 31.4597L34.1035 19.124"

/** Measured off the paths: react-native-svg's `pathLength` is not honoured on Android. */
const BADGE_LENGTH = 145.72
const CHECK_LENGTH = 26.8

/**
 * A round cap reaches half a stroke past the end of its dash, so a dash parked exactly at
 * the path start still shows a dot. Park it a full stroke back, and keep the gap long
 * enough that the next dash never reaches the path either.
 */
const CAP_CLEARANCE = STROKE_WIDTH

const BADGE_DRAW_MS = 600
/** The check starts just before the badge closes, so the two read as one stroke. */
const CHECK_DELAY_MS = 500
const CHECK_DRAW_MS = 350
const POP_SCALE = 1.08
const POP_UP_MS = 140
const POP_SETTLE_MS = 200

const dashArray = (length: number) => [length, length + 2 * CAP_CLEARANCE]

type SuccessBadgeProps = {
  size?: number
  color?: string
  /** Holds the drawing back, to land it after whatever leads into it. */
  delay?: number
}

/**
 * The success seal drawing itself in: the badge outline, then the check, then a small pop
 * once the check lands. Plays once on mount and holds fully drawn. Reanimated's default
 * reduce-motion handling jumps each step to its end.
 */
export const SuccessBadge: React.FC<SuccessBadgeProps> = ({
  size = VIEWBOX_SIZE,
  color,
  delay = 0,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const badge = useSharedValue(0)
  const check = useSharedValue(0)
  const scale = useSharedValue(1)

  useEffect(() => {
    badge.value = withDelay(
      delay,
      withTiming(1, { duration: BADGE_DRAW_MS, easing: Easing.inOut(Easing.cubic) }),
    )
    check.value = withDelay(
      delay + CHECK_DELAY_MS,
      withTiming(1, { duration: CHECK_DRAW_MS, easing: Easing.out(Easing.cubic) }),
    )
    scale.value = withDelay(
      delay + CHECK_DELAY_MS + CHECK_DRAW_MS,
      withSequence(
        withTiming(POP_SCALE, { duration: POP_UP_MS, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: POP_SETTLE_MS, easing: Easing.inOut(Easing.quad) }),
      ),
    )
  }, [delay, badge, check, scale])

  const badgeProps = useAnimatedProps(
    () => ({ strokeDashoffset: (BADGE_LENGTH + CAP_CLEARANCE) * (1 - badge.value) }),
    [badge],
  )
  const checkProps = useAnimatedProps(
    () => ({ strokeDashoffset: (CHECK_LENGTH + CAP_CLEARANCE) * (1 - check.value) }),
    [check],
  )
  const popStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }] }),
    [scale],
  )

  const stroke = color ?? colors._green

  return (
    <Animated.View style={[{ width: size, height: size }, popStyle]}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        fill="none"
      >
        <AnimatedPath
          d={BADGE_PATH}
          stroke={stroke}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashArray(BADGE_LENGTH)}
          animatedProps={badgeProps}
        />
        <AnimatedPath
          d={CHECK_PATH}
          stroke={stroke}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashArray(CHECK_LENGTH)}
          animatedProps={checkProps}
        />
      </Svg>
    </Animated.View>
  )
}
