import React from "react"
import { StyleSheet, View } from "react-native"
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated"
import { makeStyles } from "@rn-vui/themed"

/** Clear through the middle, so the glow never sits on the hero itself. */
const CLEAR_STOP = 0.28
/**
 * The gradient is sized to the view's corner, so the circle's rim sits at 1/√2 of it.
 * Past the rim it turns transparent on a hard stop, so the square's corners never show
 * `grey6` while the bloom is still inside the screen.
 */
const RIM_STOP = Math.SQRT1_2
const percent = (stop: number) => `${(stop * 100).toFixed(2)}%`
/** A transform at scale 0 cannot be inverted; this is well under a pixel. */
const MIN_SCALE = 0.001

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
 * sinks into white in light mode with no colour of its own.
 *
 * Drawn once at full size with a native gradient and grown by scaling alone. A scale
 * pivots on the view's own centre, so the bloom starts at the centre it is given, and a
 * transform touches neither layout nor the view's props, so a re-render once it has
 * bloomed leaves it where it is.
 */
const SuccessGlowBase: React.FC<SuccessGlowProps> = ({
  progress,
  centerX,
  centerY,
  radius,
}) => {
  const styles = useStyles()

  const bloomStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: Math.max(progress.value, MIN_SCALE) }] }),
    [progress],
  )

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.bloom,
          {
            left: centerX - radius,
            top: centerY - radius,
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
          },
          bloomStyle,
        ]}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  bloom: {
    position: "absolute",
    // React Native names its gradient style this way; it is not ours to rename.
    // eslint-disable-next-line camelcase
    experimental_backgroundImage: `radial-gradient(circle farthest-corner, ${colors.white} 0%, ${colors.white} ${percent(CLEAR_STOP * RIM_STOP)}, ${colors.grey6} ${percent(RIM_STOP)}, transparent ${percent(RIM_STOP)})`,
  },
}))

/** Memoised so a parent re-render mid-bloom (a balance sync landing) does not rebuild the
 *  gradient. */
export const SuccessGlow = React.memo(SuccessGlowBase)
