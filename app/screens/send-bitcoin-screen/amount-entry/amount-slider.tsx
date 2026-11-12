import React, { useEffect, useState } from "react"
import { LayoutChangeEvent, View, useWindowDimensions } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { makeStyles, Text } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { fonts } from "@app/rne-theme/fonts"
import { haptics } from "@app/utils/haptics"

export const AMOUNT_SLIDER_TEST_ID = "send-amount-slider"
export const AMOUNT_SLIDER_BADGE_TEST_ID = "send-amount-slider-badge"
export const AMOUNT_SLIDER_TRACK_TEST_ID = "send-amount-slider-track"
export const AMOUNT_SLIDER_PAN_TEST_ID = "send-amount-slider-pan"

const THUMB_SIZE = 18
/** The held thumb's ring, drawn 10 out from the thumb all round. */
const HALO_SIZE = THUMB_SIZE + 20
/** Figma rests the thumb's centre 5 in from each end of the track. */
const THUMB_INSET = 5
const TRACK_HEIGHT = 4
/** The thumb can be taken anywhere in a 42 box round it, at either end too. Android drops
 *  touches outside a parent's bounds, so the box is real layout, not hitSlop. */
const THUMB_HIT_SIZE = 42
const TOUCH_PADDING_VERTICAL = (THUMB_HIT_SIZE - TRACK_HEIGHT) / 2
const TOUCH_PADDING_HORIZONTAL = THUMB_HIT_SIZE / 2 - THUMB_INSET
/** Figma: the track sits 10 under the block's top and 10 over the hint. */
const TRACK_TOP_GAP = 10
const HINT_GAP = 10
/** Figma draws a 270 track on a 360 screen; it keeps that share of the screen's width, so
 *  it doesn't stretch on wide phones and still fits a 320 one. */
const TRACK_SCREEN_SHARE = 270 / 360
/** Wide enough for "100%"; the badge is centred in it over the thumb. */
const BADGE_SLOT_WIDTH = 60
/** Figma's badge bottom sits 24 above the track. */
const BADGE_GAP = 24
const BADGE_HEIGHT = 21

/** From here on the drag is the whole balance, which a rail that can send all sends with
 *  the fee taken out. */
const SNAP_TO_FULL_PERCENT = 96
const MOVE_MS = 220
const PRESS_MS = 120
/** Figma's ring is the foreground at 10%. */
const HALO_OPACITY = 0.1
/** Figma's thumb shadow: black at 20%, blurred 12, no offset. */
const THUMB_SHADOW_BLUR = 12
const THUMB_SHADOW_ALPHA = "33"

const clamp = (value: number, max: number) => {
  "worklet"
  return Math.min(Math.max(value, 0), max)
}

const percentAt = (position: number, travel: number) => {
  "worklet"
  if (travel <= 0) return 0
  const percent = Math.round((position / travel) * 100)
  return percent >= SNAP_TO_FULL_PERCENT ? 100 : percent
}

type AmountSliderProps = {
  /** The amount's share of the wallet balance, 0 to 1. Typing moves the thumb here. */
  share: number
  /** A whole percent of the balance, from a drag. */
  onSlide: (percent: number) => void
  /** The fill's colour: green for the Dollar wallet, as slide to send. */
  accentColor?: string
  /** "Slide to select amount" under the track, until the sender has learned the slider. */
  showHint?: boolean
  /** The thumb was taken or let go: a scrolling parent stands still meanwhile, so a drag
   *  that wanders off level is not taken for a scroll. */
  onHoldChange?: (isHeld: boolean) => void
}

/**
 * Picks a share of the balance. Dragging shows the percent over a ringed thumb; an amount
 * typed on the keypad just moves the thumb, with no badge and no ring.
 */
export const AmountSlider: React.FC<AmountSliderProps> = ({
  share,
  onSlide,
  accentColor,
  showHint = true,
  onHoldChange,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { width: screenWidth } = useWindowDimensions()
  const touchAreaWidth =
    Math.round(screenWidth * TRACK_SCREEN_SHARE) + 2 * TOUCH_PADDING_HORIZONTAL

  const [trackWidth, setTrackWidth] = useState(0)
  const [heldPercent, setHeldPercent] = useState<number | null>(null)
  const travel = Math.max(trackWidth - 2 * THUMB_INSET, 0)

  const position = useSharedValue(0)
  const pressed = useSharedValue(0)
  const lastPercent = useSharedValue(-1)

  const isHeld = heldPercent !== null

  // A typed amount glides the thumb into place; while held, the finger has it.
  useEffect(() => {
    if (isHeld) return
    position.value = withTiming(clamp(share, 1) * travel, {
      duration: MOVE_MS,
      easing: Easing.out(Easing.cubic),
    })
  }, [share, travel, isHeld, position])

  const onTrackLayout = (event: LayoutChangeEvent) =>
    setTrackWidth(event.nativeEvent.layout.width)

  const hold = (percent: number) => {
    haptics.grab()
    onHoldChange?.(true)
    setHeldPercent(percent)
    onSlide(percent)
  }

  const slide = (percent: number) => {
    if (percent === 100) haptics.select()
    setHeldPercent(percent)
    onSlide(percent)
  }

  const release = () => {
    onHoldChange?.(false)
    setHeldPercent(null)
  }

  const pan = Gesture.Pan()
    .withTestId(AMOUNT_SLIDER_PAN_TEST_ID)
    .minDistance(0)
    .onBegin((event) => {
      const next = clamp(event.x - TOUCH_PADDING_HORIZONTAL - THUMB_INSET, travel)
      const percent = percentAt(next, travel)
      position.value = percent === 100 ? travel : next
      pressed.value = withTiming(1, { duration: PRESS_MS })
      lastPercent.value = percent
      runOnJS(hold)(percent)
    })
    .onUpdate((event) => {
      const next = clamp(event.x - TOUCH_PADDING_HORIZONTAL - THUMB_INSET, travel)
      const percent = percentAt(next, travel)
      position.value = percent === 100 ? travel : next
      if (percent !== lastPercent.value) {
        lastPercent.value = percent
        runOnJS(slide)(percent)
      }
    })
    .onFinalize(() => {
      // Settles on the percent the amount was set to, so the thumb shows what is sent.
      position.value = withTiming((lastPercent.value / 100) * travel, {
        duration: PRESS_MS,
      })
      pressed.value = withTiming(0, { duration: PRESS_MS })
      runOnJS(release)()
    })

  const fillStyle = useAnimatedStyle(
    () => ({ width: position.value + THUMB_INSET }),
    [position],
  )
  const thumbStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: position.value + THUMB_INSET - HALO_SIZE / 2 }] }),
    [position],
  )
  const haloStyle = useAnimatedStyle(
    () => ({ opacity: pressed.value * HALO_OPACITY }),
    [pressed],
  )
  const badgeStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: position.value + THUMB_INSET - BADGE_SLOT_WIDTH / 2 }],
    }),
    [position],
  )

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.touchArea, { width: touchAreaWidth }]}
          testID={AMOUNT_SLIDER_TEST_ID}
        >
          <View
            style={styles.track}
            onLayout={onTrackLayout}
            testID={AMOUNT_SLIDER_TRACK_TEST_ID}
          >
            <Animated.View
              style={[
                styles.fill,
                accentColor && { backgroundColor: accentColor },
                fillStyle,
              ]}
            />
            <Animated.View style={[styles.thumbSlot, thumbStyle]} pointerEvents="none">
              <Animated.View style={[styles.halo, haloStyle]} />
              <View style={styles.thumb} />
            </Animated.View>
            {isHeld && (
              <Animated.View
                style={[styles.badgeSlot, badgeStyle]}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.badge}>
                  <Text style={styles.badgeText} testID={AMOUNT_SLIDER_BADGE_TEST_ID}>
                    {`${heldPercent}%`}
                  </Text>
                </View>
              </Animated.View>
            )}
          </View>
        </View>
      </GestureDetector>
      {showHint && (
        <Text type="p4" style={styles.caption}>
          {LL.SendBitcoinScreen.slideToSelectAmount()}
        </Text>
      )}
    </View>
  )
}

/** Figma frame `slider-%bar` (30359:128569): the track centred under the amount. */
const useStyles = makeStyles(({ colors }) => ({
  /** Pulled up into the gap above so the touch area, not empty padding, fills it. */
  container: {
    alignItems: "center",
    marginTop: TRACK_TOP_GAP - TOUCH_PADDING_VERTICAL,
    zIndex: 1,
  },
  /** Never wider than the body it sits in. */
  touchArea: {
    maxWidth: "100%",
    paddingVertical: TOUCH_PADDING_VERTICAL,
    paddingHorizontal: TOUCH_PADDING_HORIZONTAL,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.grey5,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.primary,
  },
  thumbSlot: {
    position: "absolute",
    left: 0,
    top: (TRACK_HEIGHT - HALO_SIZE) / 2,
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  /** `black` is the foreground token, so light mode gets the matching dark ring. */
  halo: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: colors.black,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors._white,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 0,
        blurRadius: THUMB_SHADOW_BLUR,
        color: `${colors._black}${THUMB_SHADOW_ALPHA}`,
      },
    ],
  },
  badgeSlot: {
    position: "absolute",
    left: 0,
    top: -(BADGE_GAP + BADGE_HEIGHT),
    width: BADGE_SLOT_WIDTH,
    alignItems: "center",
  },
  badge: {
    height: BADGE_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.grey4,
  },
  /** Paragraph 5/Bold: no text type has it. */
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 13,
    color: colors.grey1,
  },
  caption: {
    marginTop: HINT_GAP - TOUCH_PADDING_VERTICAL,
    color: colors.grey2,
    textAlign: "center",
  },
}))
