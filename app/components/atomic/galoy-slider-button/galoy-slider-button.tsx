import React, { useEffect } from "react"
import { ActivityIndicator, Dimensions, View, I18nManager } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Extrapolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"

import { testProps } from "@app/utils/testProps"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { MAX_FONT_SIZE_MULTIPLIER } from "@app/rne-theme/text-scaling"

import { GaloyIcon } from "../galoy-icon"

const BUTTON_WIDTH = Dimensions.get("screen").width - 40
const SWIPE_RANGE = BUTTON_WIDTH - 50
/** The knob's diameter, which the label has to stay clear of. */
const SWIPE_KNOB_SIZE = 60
const isRTL = I18nManager.isRTL

type SwipeButtonPropsType = {
  onSwipe: () => void
  initialText: string
  loadingText: string
  isLoading?: boolean
  disabled?: boolean
}

const GaloySliderButton = ({
  onSwipe,
  initialText,
  loadingText,
  isLoading = false,
  disabled = false,
}: SwipeButtonPropsType) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const X = useSharedValue(0)

  useEffect(() => {
    if (!isLoading) {
      X.value = withSpring(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  const panGesture = Gesture.Pan()
    .enabled(!isLoading && !disabled)
    .onUpdate((e) => {
      const newValue = Math.abs(e.translationX)

      if (newValue >= 0 && newValue <= SWIPE_RANGE) {
        X.value = newValue
      }
    })
    .onEnd(() => {
      if (X.value < SWIPE_RANGE * 0.6) {
        X.value = withSpring(0)
      } else {
        runOnJS(onSwipe)()
      }
    })

  const AnimatedStyles = {
    swipeButton: useAnimatedStyle(() => {
      const translateX = interpolate(
        X.value,
        [20, BUTTON_WIDTH],
        [0, BUTTON_WIDTH],
        Extrapolation.CLAMP,
      )

      return {
        transform: [
          {
            translateX: isRTL ? -translateX : translateX,
          },
        ],
      }
    }, [X, isRTL]),
    swipeText: useAnimatedStyle(() => {
      const translateX = interpolate(
        X.value,
        [20, SWIPE_RANGE],
        [0, BUTTON_WIDTH / 3],
        Extrapolate.CLAMP,
      )
      return {
        opacity: interpolate(X.value, [0, BUTTON_WIDTH / 4], [1, 0], Extrapolate.CLAMP),
        transform: [
          {
            translateX: isRTL ? -translateX : translateX,
          },
        ],
      }
    }, [X, isRTL]),
  }

  return (
    <View style={styles.swipeButtonContainer}>
      {!isLoading && (
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.swipeButton,
              AnimatedStyles.swipeButton,
              { backgroundColor: disabled ? colors.disabled : colors.primary },
            ]}
            exiting={FadeOut.duration(400)}
            {...testProps("slider")}
          >
            {isRTL ? (
              <GaloyIcon size={30} name="arrow-left" color="white" />
            ) : (
              <GaloyIcon size={30} name="arrow-right" color="white" />
            )}
          </Animated.View>
        </GestureDetector>
      )}
      {!disabled && (
        <Animated.Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={[styles.swipeText, AnimatedStyles.swipeText]}
        >
          {initialText}
        </Animated.Text>
      )}
      {isLoading && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.loadingContainer}>
          <Text style={styles.swipeText}>{loadingText}</Text>
          <ActivityIndicator size="small" color={colors.primary} />
        </Animated.View>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  swipeButtonContainer: {
    height: 60,
    backgroundColor: colors.grey5,
    borderRadius: 30,
    borderColor: colors.grey4,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    width: BUTTON_WIDTH,
    position: "relative",
  },
  swipeButton: {
    position: "absolute",
    left: 0,
    height: SWIPE_KNOB_SIZE,
    width: SWIPE_KNOB_SIZE,
    borderRadius: 30,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeButtonDisabled: {
    backgroundColor: "#E4E9EE",
  },
  swipeText: {
    alignSelf: "center",
    /** The knob rides over the left of the track, so the label keeps clear of it rather
     *  than running underneath: at the larger text sizes it grew into the knob and read as
     *  a half word. Wrapping inside what is left still fits the track's height. */
    /** Only the left needs clearing: the knob rests there and the label reads to its
     *  right. Padding both sides would cost the label twice the room on a small screen. */
    paddingLeft: SWIPE_KNOB_SIZE + 10,
    paddingRight: 12,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "400",
    zIndex: 2,
    color: colors.grey2,
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 10,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
}))

export default GaloySliderButton
