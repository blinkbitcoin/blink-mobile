import React from "react"
import { StyleSheet, View } from "react-native"
import Animated, { SharedValue, useAnimatedProps } from "react-native-reanimated"
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg"
import { useTheme } from "@rn-vui/themed"

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const GRADIENT_ID = "success-glow"
/** Clear through the middle, so the glow never sits on the hero itself. */
const CLEAR_STOP = 0.28
const MIN_RADIUS = 1

type SuccessGlowProps = {
  /** 0 before the payment lands, 1 once the glow has fully bloomed. */
  progress: SharedValue<number>
  centerX: number
  centerY: number
  /** Radius at full bloom. */
  radius: number
}

/**
 * The soft bloom behind a success hero (Sent, and Received to come). It runs from the
 * screen's own ground to `grey6`, both theme tokens, so it lifts off black in dark mode and
 * sinks into white in light mode with no colour of its own. In dark mode `grey6` sits where
 * Figma's 15% white rim does. The stops are opaque, which is safe because the glow is always
 * the backmost layer.
 *
 * Drawn on a screen-sized canvas with an animated radius rather than by scaling a view the
 * size of the bloom, which on Android would back a bitmap several times the screen. The
 * gradient is sized to the circle's own box, so it grows with it.
 */
const SuccessGlowBase: React.FC<SuccessGlowProps> = ({
  progress,
  centerX,
  centerY,
  radius,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  // Never 0: Android's radial gradient throws on a zero radius and takes the app down, and
  // the glow sits at 0 through its delay. A 1pt circle behind the hero is invisible.
  const circleProps = useAnimatedProps(
    () => ({ r: Math.max(progress.value * radius, MIN_RADIUS) }),
    [progress, radius],
  )

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={GRADIENT_ID} cx="50%" cy="50%" r="50%">
            <Stop offset={0} stopColor={colors.white} />
            <Stop offset={CLEAR_STOP} stopColor={colors.white} />
            <Stop offset={1} stopColor={colors.grey6} />
          </RadialGradient>
        </Defs>
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill={`url(#${GRADIENT_ID})`}
          animatedProps={circleProps}
        />
      </Svg>
    </View>
  )
}

/** Memoised so a parent re-render mid-bloom (a balance sync landing) never re-commits the
 *  circle and resets the radius the animation is driving. */
export const SuccessGlow = React.memo(SuccessGlowBase)
