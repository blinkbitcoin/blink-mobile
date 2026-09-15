import React, { useCallback, useEffect, useState } from "react"
import { I18nManager, LayoutChangeEvent, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import Svg, { Rect } from "react-native-svg"

import { testProps } from "@app/utils/testProps"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../galoy-icon"

const TRACK_HEIGHT = 50
const HANDLE_SIZE = 50
/** Share of the travel the handle must cover before the send commits. */
const COMMIT_THRESHOLD = 0.7
/** Share of the travel after which the handle starts fading out. */
const HANDLE_FADE_START = 0.9
const DISABLED_OPACITY = 0.5
const COMPLETE_DURATION_MS = 300
const LABEL_INTERVAL_MS = 3000
const TYPE_INTERVAL_MS = 35
const DOT_INTERVAL_MS = 350
/** Border arc speed in revolutions per second, easing from start to end over the ramp. */
const ARC_SPEED_START = 0.6
const ARC_SPEED_END = 0.3
const ARC_RAMP_MS = 10000
/** Gap share of the border, oscillating around the mean. */
const ARC_GAP_MEAN = 85 / 360
const ARC_GAP_SWING = 45 / 360
const ARC_GAP_RATE = Math.PI * 0.9

const isRTL = I18nManager.isRTL

export const SLIDER_PAN_TEST_ID = "slider-pan"
export const SLIDER_TRACK_TEST_ID = "slider-track"

const AnimatedRect = Animated.createAnimatedComponent(Rect)

type SwipeButtonPropsType = {
  onSwipe: () => unknown
  initialText: string
  /** Busy label when no `busyLabels` are given. */
  loadingText: string
  /** Busy labels shown in turn, typed in, holding on the last one. */
  busyLabels?: readonly string[]
  /** Label while disabled; falls back to `initialText`. */
  disabledText?: string
  isLoading?: boolean
  disabled?: boolean
  /** Handle colour; defaults to `primary`. */
  accentColor?: string
}

const GaloySliderButton = ({
  onSwipe,
  initialText,
  loadingText,
  busyLabels,
  disabledText,
  isLoading = false,
  disabled = false,
  accentColor,
}: SwipeButtonPropsType) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const [trackWidth, setTrackWidth] = useState(0)
  const [committed, setCommitted] = useState(false)
  const busy = committed || isLoading
  const travel = Math.max(trackWidth - HANDLE_SIZE, 0)

  const X = useSharedValue(0)
  const hasCommitted = useSharedValue(false)

  useEffect(() => {
    if (!busy) {
      hasCommitted.value = false
      X.value = withSpring(0)
    }
  }, [busy, X, hasCommitted])

  const commit = useCallback(async () => {
    setCommitted(true)
    ReactNativeHapticFeedback.trigger("impactMedium", {
      ignoreAndroidSystemSettings: true,
    })
    try {
      await onSwipe()
    } finally {
      setCommitted(false)
    }
  }, [onSwipe])

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)

  const panGesture = Gesture.Pan()
    .withTestId(SLIDER_PAN_TEST_ID)
    .enabled(!busy && !disabled && travel > 0)
    .onUpdate((e) => {
      if (hasCommitted.value) return
      const distance = isRTL ? -e.translationX : e.translationX
      const next = Math.min(Math.max(distance, 0), travel)
      if (next >= travel * COMMIT_THRESHOLD) {
        hasCommitted.value = true
        X.value = withTiming(travel, {
          duration: COMPLETE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        })
        runOnJS(commit)()
        return
      }
      X.value = next
    })
    .onFinalize(() => {
      if (!hasCommitted.value) {
        X.value = withSpring(0)
      }
    })

  const dimmed = disabled && !busy
  const handleStyle = useAnimatedStyle(() => {
    const progress = travel > 0 ? X.value / travel : 0
    const fade =
      progress <= HANDLE_FADE_START
        ? 1
        : Math.max(0, 1 - (progress - HANDLE_FADE_START) / (1 - HANDLE_FADE_START))
    return {
      opacity: fade * (dimmed ? DISABLED_OPACITY : 1),
      transform: [{ translateX: isRTL ? -X.value : X.value }],
    }
  }, [travel, dimmed])

  const labelStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        X.value,
        [0, Math.max(travel * COMMIT_THRESHOLD, 1)],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    }),
    [travel],
  )

  const idleLabel = disabled ? disabledText ?? initialText : initialText

  return (
    <View
      style={[styles.track, busy && styles.trackBusy]}
      onLayout={onLayout}
      testID={SLIDER_TRACK_TEST_ID}
    >
      {busy ? (
        <>
          {trackWidth > 0 && <BusyBorder width={trackWidth} color={colors.black} />}
          <Animated.View
            entering={FadeIn.duration(250).delay(COMPLETE_DURATION_MS)}
            style={styles.labelContainer}
            pointerEvents="none"
          >
            {busyLabels?.length ? (
              <RotatingLabel labels={busyLabels} />
            ) : (
              <Text style={styles.busyText}>{loadingText}</Text>
            )}
          </Animated.View>
        </>
      ) : (
        <Animated.View style={[styles.labelContainer, labelStyle]} pointerEvents="none">
          <Text style={styles.idleText} numberOfLines={1}>
            {idleLabel}
          </Text>
        </Animated.View>
      )}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.handle,
            { backgroundColor: accentColor ?? colors.primary },
            handleStyle,
          ]}
          pointerEvents={busy ? "none" : "auto"}
          {...testProps("slider")}
        >
          <GaloyIcon
            size={26}
            name={isRTL ? "arrow-left" : "arrow-right"}
            color={colors._white}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

/** A 1px border arc that runs round the track with a breathing gap. */
const BusyBorder = ({ width, color }: { width: number; color: string }) => {
  const styles = useStyles()
  const inset = 0.5
  const w = width - inset * 2
  const h = TRACK_HEIGHT - inset * 2
  const perimeter = 2 * (w - h) + Math.PI * h

  const distance = useSharedValue(0)
  const elapsed = useSharedValue(0)

  useFrameCallback((frame) => {
    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000
    elapsed.value = frame.timeSinceFirstFrame
    const t = Math.min(1, elapsed.value / ARC_RAMP_MS)
    const eased = t * t * (3 - 2 * t)
    const speed = ARC_SPEED_START + (ARC_SPEED_END - ARC_SPEED_START) * eased
    distance.value = (distance.value + speed * perimeter * dt) % perimeter
  })

  const animatedProps = useAnimatedProps(() => {
    const gapShare =
      ARC_GAP_MEAN + ARC_GAP_SWING * Math.sin((elapsed.value / 1000) * ARC_GAP_RATE)
    const gap = gapShare * perimeter
    return {
      strokeDasharray: [perimeter - gap, gap],
      strokeDashoffset: -distance.value,
    }
  }, [perimeter])

  return (
    <Svg width={width} height={TRACK_HEIGHT} style={styles.border} pointerEvents="none">
      <AnimatedRect
        x={inset}
        y={inset}
        width={w}
        height={h}
        rx={h / 2}
        ry={h / 2}
        fill="none"
        stroke={color}
        strokeWidth={1}
        animatedProps={animatedProps}
      />
    </Svg>
  )
}

/** Types each label in, cycles trailing dots, and moves on every few seconds. */
const RotatingLabel = ({ labels }: { labels: readonly string[] }) => {
  const styles = useStyles()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)
  const [dots, setDots] = useState(0)

  const text = labels[Math.min(index, labels.length - 1)]
  const isTyped = typed >= text.length

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => Math.min(i + 1, labels.length - 1)),
      LABEL_INTERVAL_MS,
    )
    return () => clearInterval(id)
  }, [labels.length])

  useEffect(() => {
    setTyped(0)
    setDots(0)
    const id = setInterval(() => {
      setTyped((n) => {
        if (n + 1 >= text.length) clearInterval(id)
        return n + 1
      })
    }, TYPE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [text])

  useEffect(() => {
    if (!isTyped) return
    const id = setInterval(() => setDots((d) => (d + 1) % 4), DOT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isTyped])

  return (
    <Text style={styles.busyText} numberOfLines={1}>
      {text.slice(0, typed)}
      {/* Reserve the dots' width so the label does not shift as they cycle. */}
      <Text style={styles.busyText}>{".".repeat(dots)}</Text>
      <Text style={styles.hiddenDots}>{".".repeat(3 - dots)}</Text>
    </Text>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  track: {
    height: TRACK_HEIGHT,
    width: "100%",
    backgroundColor: colors.grey5,
    borderRadius: TRACK_HEIGHT / 2,
    borderColor: colors.grey4,
    borderWidth: 1,
    justifyContent: "center",
  },
  border: {
    position: "absolute",
    top: -1,
    left: -1,
  },
  trackBusy: {
    borderColor: colors.transparent,
  },
  handle: {
    position: "absolute",
    top: -1,
    start: -1,
    height: HANDLE_SIZE,
    width: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  labelContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: HANDLE_SIZE,
  },
  idleText: {
    fontSize: 14,
    color: colors.grey2,
  },
  busyText: {
    fontSize: 14,
    color: colors.black,
  },
  hiddenDots: {
    fontSize: 14,
    color: colors.transparent,
  },
}))

export default GaloySliderButton
