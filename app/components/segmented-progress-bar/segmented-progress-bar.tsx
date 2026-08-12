import React, { useEffect, useMemo, useRef } from "react"
import { Animated, View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

const ANIMATION_DURATION = 120

type SegmentProps = {
  isFilled: boolean
  fillColor: string
}

const Segment: React.FC<SegmentProps> = ({ isFilled, fillColor }) => {
  const styles = useStyles()
  const fillTarget = isFilled ? 1 : 0
  const fillAnimationRef = useRef<Animated.Value | null>(null)
  if (!fillAnimationRef.current) fillAnimationRef.current = new Animated.Value(fillTarget)
  const fillAnimation = fillAnimationRef.current
  const drivenTo = useRef(fillTarget)

  const fillWidth = useMemo(
    () =>
      fillAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
      }),
    [fillAnimation],
  )

  useEffect(() => {
    /** The segment mounts already at its final width, and re-renders that leave
     *  the target alone have nothing to move towards either. */
    if (drivenTo.current === fillTarget) return

    drivenTo.current = fillTarget
    Animated.timing(fillAnimation, {
      toValue: fillTarget,
      duration: ANIMATION_DURATION,
      useNativeDriver: false,
    }).start()
  }, [fillTarget, fillAnimation])

  return (
    <View style={styles.segment}>
      <Animated.View
        style={[styles.segmentFill, { backgroundColor: fillColor, width: fillWidth }]}
      />
    </View>
  )
}

type SegmentedProgressBarProps = {
  total: number
  filled: number
  fillColor: string
}

/**
 * Progress as one equal-width segment per unit. The segments sit flush against
 * each other, so a filled run reads as a single continuous bar while each unit
 * still animates its own width in as it completes. The bar states nothing a
 * screen reader cannot already get from the labels beside it, so it stays out
 * of the accessibility tree rather than becoming an unnamed control.
 */
export const SegmentedProgressBar: React.FC<SegmentedProgressBarProps> = ({
  total,
  filled,
  fillColor,
}) => {
  const styles = useStyles()

  /** There are only ever `total` segments to paint, so progress past either end
   *  of that range is what the bar shows. */
  const unitsFilled = Math.min(Math.max(filled, 0), total)

  return (
    <View style={styles.container}>
      {Array.from({ length: total }, (_, index) => {
        const isSegmentFilled = index < unitsFilled

        return (
          <Segment
            key={`segment-${index}`}
            isFilled={isSegmentFilled}
            fillColor={fillColor}
          />
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    width: "100%",
  },
  segment: {
    flex: 1,
    height: 2,
    overflow: "hidden",
    backgroundColor: colors.grey4,
  },
  segmentFill: {
    height: "100%",
  },
}))
