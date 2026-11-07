import React from "react"
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated"
import Svg, { Line } from "react-native-svg"

import { makeStyles, useTheme } from "@rn-vui/themed"

import {
  CHIP_SIZE,
  CONNECTOR_LENGTH,
  CONNECTOR_STROKE_WIDTH,
  DASH_OFF,
  DASH_ON,
  DASH_PERIOD,
  Z_CONNECTOR,
} from "./config"

/**
 * The strip is one full dash period wider than the gap it fills, and starts one
 * period to the left of it, so that as it marches right there is always dash to
 * see at both ends of the window.
 */
const STRIP_WIDTH = CONNECTOR_LENGTH + DASH_PERIOD

/** Tall enough for the stroke to survive rasterisation; the line sits mid-height. */
const STRIP_HEIGHT = 2

type BusyStateConnectorProps = {
  /** 0 while the chips are stacked, 1 once they have spread. */
  progress: SharedValue<number>
  /** Distance the dashes have travelled, in points, wrapping at `DASH_PERIOD`. */
  march: SharedValue<number>
}

/**
 * The dashed connector between the two chips.
 *
 * Two things move independently here:
 *
 *  - the **window**, which widens from nothing to `CONNECTOR_LENGTH` about its
 *    own centre, in lockstep with the chips spreading. It is a clipping view, so
 *    the dashes are uncovered rather than stretched — a transform would squash
 *    the dash pattern.
 *  - the **strip**, which marches right at a constant speed forever. It is
 *    translated by exactly one dash period per cycle, so the wrap is invisible.
 *
 * The strip's translation subtracts the window's own inset, which keeps the dash
 * phase pinned to the row rather than to the moving window — without it the
 * dashes would appear to slide backwards while the gap opens.
 */
export const BusyStateConnector: React.FC<BusyStateConnectorProps> = ({
  progress,
  march,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const windowStyle = useAnimatedStyle(() => {
    const inset = (CONNECTOR_LENGTH * (1 - progress.value)) / 2

    return {
      left: CHIP_SIZE + inset,
      width: CONNECTOR_LENGTH * progress.value,
    }
  })

  const stripStyle = useAnimatedStyle(() => {
    const inset = (CONNECTOR_LENGTH * (1 - progress.value)) / 2

    return { transform: [{ translateX: march.value - inset }] }
  })

  return (
    <Animated.View style={[styles.window, windowStyle]}>
      <Animated.View style={[styles.strip, stripStyle]}>
        <Svg width={STRIP_WIDTH} height={STRIP_HEIGHT}>
          <Line
            x1={0}
            y1={STRIP_HEIGHT / 2}
            x2={STRIP_WIDTH}
            y2={STRIP_HEIGHT / 2}
            stroke={colors.grey2}
            strokeWidth={CONNECTOR_STROKE_WIDTH}
            strokeDasharray={[DASH_ON, DASH_OFF]}
            strokeLinecap="butt"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}

const useStyles = makeStyles(() => ({
  window: {
    position: "absolute",
    top: (CHIP_SIZE - STRIP_HEIGHT) / 2,
    height: STRIP_HEIGHT,
    overflow: "hidden",
    zIndex: Z_CONNECTOR,
  },
  strip: {
    position: "absolute",
    left: -DASH_PERIOD,
    width: STRIP_WIDTH,
    height: STRIP_HEIGHT,
  },
}))
