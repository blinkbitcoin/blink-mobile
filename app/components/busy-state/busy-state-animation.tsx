import React, { useEffect } from "react"
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import { makeStyles } from "@rn-vui/themed"

import { BusyStateChip } from "./busy-state-chip"
import { BusyStateConnector } from "./busy-state-connector"
import {
  CHIP_SIZE,
  CHIP_TRAVEL,
  DASH_PERIOD,
  DASH_TRAVEL_MS,
  ENTRANCE_DELAY_MS,
  ENTRANCE_DURATION_MS,
  ROW_WIDTH,
  Z_ICON_1,
  Z_ICON_2,
} from "./config"

export type BusyStateAnimationProps = {
  /** Left chip, where the connection starts. Sits above `icon2` at rest. */
  icon1: React.ReactNode
  /** Right chip. Emerges from behind `icon1`. */
  icon2: React.ReactNode
  /** Fires once the entrance has settled. Not called again. */
  onEntranceComplete?: () => void
}

/**
 * The busy-state pictogram: two chips that spread apart to open a gap, and a
 * dashed connector that marches from one to the other for as long as the work
 * lasts.
 *
 * The entrance is one-shot and forward-only. It is started from a mount effect
 * and driven by a single `progress` value that only ever runs 0 → 1, rather than
 * by a toggled transition — a prop change or a re-render cannot play it
 * backwards. There is no exit.
 *
 * `icon1` is stacked above `icon2` with an explicit `zIndex`: at rest both chips
 * sit at the row's centre with `icon2` underneath, so only `icon1` is visible,
 * and `icon2` slides out from beneath it as they part. That is a z-order reveal,
 * not a fade or a scale, which is what makes it read as "emerging from behind"
 * rather than "popping in". The order is pinned with `zIndex` rather than left
 * to sibling order so iOS and Android stack it the same way.
 *
 * Under `useReducedMotion` the resting state is rendered immediately and nothing
 * moves at all — including the dashes. The busy signal is then carried by the
 * `progressbar` role on the text, which `BusyStateScreen` sets.
 */
export const BusyStateAnimation: React.FC<BusyStateAnimationProps> = ({
  icon1,
  icon2,
  onEntranceComplete,
}) => {
  const styles = useStyles()
  const reducedMotion = useReducedMotion()

  const progress = useSharedValue(reducedMotion ? 1 : 0)
  const march = useSharedValue(0)

  useEffect(() => {
    if (reducedMotion) {
      onEntranceComplete?.()
      return
    }

    // Both hold for `ENTRANCE_DELAY_MS` first, so the pictogram is genuinely
    // still on arrival rather than merely hidden behind a zero-width window.
    progress.value = withDelay(
      ENTRANCE_DELAY_MS,
      withTiming(
        1,
        { duration: ENTRANCE_DURATION_MS, easing: Easing.inOut(Easing.ease) },
        (finished) => {
          if (finished && onEntranceComplete) runOnJS(onEntranceComplete)()
        },
      ),
    )

    // Constant speed, and exactly one dash period per cycle so the wrap back to
    // zero lands on an identical frame.
    march.value = withDelay(
      ENTRANCE_DELAY_MS,
      withRepeat(
        withTiming(DASH_PERIOD, { duration: DASH_TRAVEL_MS, easing: Easing.linear }),
        -1,
        false,
      ),
    )

    return () => {
      cancelAnimation(progress)
      cancelAnimation(march)
    }
    // Started once on mount: the entrance is not re-triggerable by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const icon1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: CHIP_TRAVEL * (1 - progress.value) }],
  }))

  const icon2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: -CHIP_TRAVEL * (1 - progress.value) }],
  }))

  return (
    <Animated.View
      style={styles.row}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {/*
        The connector is at the bottom of the stack so that while the chips are
        still parting, each of them covers the stretch of line it is sitting on:
        the window is wider than the gap at that moment, and a connector drawn
        over a chip would show dashes crossing the glyph.
      */}
      <BusyStateConnector progress={progress} march={march} />

      <Animated.View style={[styles.chipRight, icon2Style]}>
        <BusyStateChip icon={icon2} />
      </Animated.View>

      <Animated.View style={[styles.chipLeft, icon1Style]}>
        <BusyStateChip icon={icon1} />
      </Animated.View>
    </Animated.View>
  )
}

const useStyles = makeStyles(() => ({
  // Fixed box: the spread is pure transform, so nothing here ever reflows.
  row: {
    width: ROW_WIDTH,
    height: CHIP_SIZE,
  },
  chipLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: Z_ICON_1,
  },
  chipRight: {
    position: "absolute",
    left: ROW_WIDTH - CHIP_SIZE,
    top: 0,
    zIndex: Z_ICON_2,
  },
}))
