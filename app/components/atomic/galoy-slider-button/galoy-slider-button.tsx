import React, { Ref, useCallback, useEffect, useMemo, useState } from "react"
import {
  AccessibilityActionEvent,
  AccessibilityInfo,
  I18nManager,
  LayoutChangeEvent,
  View,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import Svg, { Rect } from "react-native-svg"

import { reportError } from "@app/utils/error-logging"
import { haptics } from "@app/utils/haptics"
import { testProps } from "@app/utils/testProps"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../galoy-icon"

const TRACK_HEIGHT = 60
const HANDLE_SIZE = 60
/** Share of the travel the handle must be past, on release, for the send to commit. */
const COMMIT_THRESHOLD = 0.7
/** Share of the travel after which the handle starts fading out. */
const HANDLE_FADE_START = 0.9
const DISABLED_OPACITY = 0.5
const COMPLETE_DURATION_MS = 300
/** How long each busy label holds before the next; the last one holds until the send ends. */
export const LABEL_INTERVAL_MS = 3000
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
  /** May return a promise; the slider stays busy until it settles. A rejection is reported
   *  and the slider returns to rest. */
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
  /** Handle colour; defaults to `accent`. The arrow on it is white in both themes. */
  accentColor?: string
  /** The handle, the one element a screen reader reaches, e.g. to move focus to it. */
  handleRef?: Ref<View>
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
  handleRef,
}: SwipeButtonPropsType) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const [trackWidth, setTrackWidth] = useState(0)
  const [committed, setCommitted] = useState(false)
  /** Bumped each time a swipe settles. An `onSwipe` that resolves at once batches the
   *  busy render away, so the reset can't wait for `busy` to go true and back. */
  const [settled, setSettled] = useState(0)
  const busy = committed || isLoading
  const travel = Math.max(trackWidth - HANDLE_SIZE, 0)

  const X = useSharedValue(0)
  const hasCommitted = useSharedValue(false)

  useEffect(() => {
    if (!busy) {
      hasCommitted.value = false
      X.value = withSpring(0)
    }
  }, [busy, settled, X, hasCommitted])

  const commit = useCallback(async () => {
    setCommitted(true)
    haptics.commit()
    try {
      await onSwipe()
    } catch (err) {
      reportError("Slider onSwipe", err)
    } finally {
      setCommitted(false)
      setSettled((n) => n + 1)
    }
  }, [onSwipe])

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)

  /** Locks the handle and glides it to the end, for the drag and the screen reader alike.
   *  Returns false when a send is already under way: a screen-reader activate can land
   *  mid-drag, before the busy render has disabled the pan. */
  const lockHandle = () => {
    "worklet"
    if (hasCommitted.value) return false
    hasCommitted.value = true
    X.value = withTiming(travel, {
      duration: COMPLETE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    })
    return true
  }

  const panGesture = Gesture.Pan()
    .withTestId(SLIDER_PAN_TEST_ID)
    .enabled(!busy && !disabled && travel > 0)
    /** A light buzz as the finger lands on the handle, before it moves: it has the
     *  handle and can slide. Silent while disabled or busy, when the pan is off. */
    .onBegin(() => {
      runOnJS(haptics.grab)()
    })
    .onUpdate((e) => {
      if (hasCommitted.value) return
      const distance = isRTL ? -e.translationX : e.translationX
      X.value = Math.min(Math.max(distance, 0), travel)
    })
    // Sends only on release, so a user who went too far can still slide back.
    .onEnd((_e, success) => {
      if (!success || X.value < travel * COMMIT_THRESHOLD) return
      if (lockHandle()) runOnJS(commit)()
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
  const busyLabel = busyLabels?.[0] ?? loadingText

  /** A screen reader, Switch Control or Voice Control can't drag: their activate (a double
   *  tap) sends the same way a full slide does. */
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName !== "activate") return
    if (busy || disabled) return
    if (!lockHandle()) return
    AccessibilityInfo.announceForAccessibility(busyLabel)
    commit()
  }

  return (
    <View
      style={[styles.track, busy && styles.trackBusy]}
      onLayout={onLayout}
      testID={SLIDER_TRACK_TEST_ID}
    >
      {busy ? (
        <>
          {trackWidth > 0 && (
            <BusyBorder width={trackWidth} color={colors.textOnBackground} />
          )}
          <Animated.View
            entering={FadeIn.duration(250).delay(COMPLETE_DURATION_MS)}
            style={styles.labelContainer}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {busyLabels?.length ? (
              <RotatingLabel labels={busyLabels} />
            ) : (
              <Text style={styles.busyText}>{loadingText}</Text>
            )}
          </Animated.View>
        </>
      ) : (
        <Animated.View
          style={[styles.labelContainer, labelStyle]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.idleText} numberOfLines={1}>
            {idleLabel}
          </Text>
        </Animated.View>
      )}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          ref={handleRef}
          style={[
            styles.handle,
            { backgroundColor: accentColor ?? colors.accent },
            handleStyle,
          ]}
          pointerEvents={busy ? "none" : "auto"}
          {...testProps("slider")}
          /* The handle is the one element a screen reader reaches, named for the label on
             the track (which it hides) and sent by an activate. */
          accessibilityRole="button"
          accessibilityLabel={busy ? busyLabel : idleLabel}
          accessibilityState={{ disabled: disabled || busy, busy }}
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={onAccessibilityAction}
        >
          <GaloyIcon
            size={30}
            name={isRTL ? "arrow-left" : "arrow-right"}
            // Design ruling: the arrow is white on every handle colour, in both themes.
            // eslint-disable-next-line no-restricted-properties
            color={colors.staticWhite}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

/** A 1px border arc that runs round the track with a breathing gap; with reduce motion on,
 *  a still, closed border. */
const BusyBorder = ({ width, color }: { width: number; color: string }) => {
  const styles = useStyles()
  const reduceMotion = useReducedMotion()
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
  }, !reduceMotion)

  const animatedProps = useAnimatedProps(() => {
    if (reduceMotion) return { strokeDasharray: [perimeter, 0], strokeDashoffset: 0 }
    const gapShare =
      ARC_GAP_MEAN + ARC_GAP_SWING * Math.sin((elapsed.value / 1000) * ARC_GAP_RATE)
    const gap = gapShare * perimeter
    return {
      strokeDasharray: [perimeter - gap, gap],
      strokeDashoffset: -distance.value,
    }
  }, [perimeter, reduceMotion])

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

/** What the typing steps through: each character with the marks that sit on it, so a Thai
 *  tone mark never shows on its own and an emoji is never split in half. */
const toCharacters = (text: string): string[] => text.match(/\P{M}\p{M}*/gu) ?? []

/** Types each label in, cycles trailing dots, and moves on every few seconds. With reduce
 *  motion on, each label shows whole, with still dots. */
const RotatingLabel = ({ labels }: { labels: readonly string[] }) => {
  const styles = useStyles()
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)
  const [dots, setDots] = useState(reduceMotion ? 3 : 0)

  const text = labels[Math.min(index, labels.length - 1)]
  const characters = useMemo(() => toCharacters(text), [text])
  const isTyped = reduceMotion || typed >= characters.length

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => Math.min(i + 1, labels.length - 1)),
      LABEL_INTERVAL_MS,
    )
    return () => clearInterval(id)
  }, [labels.length])

  useEffect(() => {
    if (reduceMotion) return
    setTyped(0)
    setDots(0)
    const id = setInterval(() => {
      setTyped((n) => {
        if (n + 1 >= characters.length) clearInterval(id)
        return n + 1
      })
    }, TYPE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [characters, reduceMotion])

  useEffect(() => {
    if (!isTyped || reduceMotion) return
    const id = setInterval(() => setDots((d) => (d + 1) % 4), DOT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isTyped, reduceMotion])

  return (
    <Text style={styles.busyText} numberOfLines={1}>
      {isTyped ? text : characters.slice(0, typed).join("")}
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
    backgroundColor: colors.surfaceInteractive,
    borderRadius: TRACK_HEIGHT / 2,
    borderColor: colors.neutral,
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
    color: colors.textMuted,
  },
  busyText: {
    fontSize: 14,
    color: colors.textOnBackground,
  },
  hiddenDots: {
    fontSize: 14,
    color: colors.transparent,
  },
}))

export default GaloySliderButton
