import React, { useEffect } from "react"
import { ActivityIndicator, I18nManager, useWindowDimensions, View } from "react-native"
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

import { GaloyIcon } from "../galoy-icon"

/** The track spans the screen less the padding its callers put either side. */
const TRACK_INSET = 40
/** How far short of the track's end the travel stops. Not the handle's width, which is
 *  60: this is the pre-existing figure, kept so the commit threshold does not move. */
const TRAVEL_INSET = 50
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
  const { width: screenWidth } = useWindowDimensions()
  const buttonWidth = screenWidth - TRACK_INSET
  const swipeRange = buttonWidth - TRAVEL_INSET
  const styles = useStyles({ buttonWidth })

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

      if (newValue >= 0 && newValue <= swipeRange) {
        X.value = newValue
      }
    })
    .onEnd(() => {
      if (X.value < swipeRange * 0.6) {
        X.value = withSpring(0)
      } else {
        runOnJS(onSwipe)()
      }
    })

  const AnimatedStyles = {
    swipeButton: useAnimatedStyle(() => {
      const translateX = interpolate(
        X.value,
        [20, buttonWidth],
        [0, buttonWidth],
        Extrapolation.CLAMP,
      )

      return {
        transform: [
          {
            translateX: isRTL ? -translateX : translateX,
          },
        ],
      }
    }, [X, isRTL, buttonWidth]),
    swipeText: useAnimatedStyle(() => {
      const translateX = interpolate(
        X.value,
        [20, swipeRange],
        [0, buttonWidth / 3],
        Extrapolate.CLAMP,
      )
      return {
        opacity: interpolate(X.value, [0, buttonWidth / 4], [1, 0], Extrapolate.CLAMP),
        transform: [
          {
            translateX: isRTL ? -translateX : translateX,
          },
        ],
      }
    }, [X, isRTL, buttonWidth, swipeRange]),
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
        <Animated.Text style={[styles.swipeText, AnimatedStyles.swipeText]}>
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

const useStyles = makeStyles(({ colors }, { buttonWidth }: { buttonWidth: number }) => ({
  swipeButtonContainer: {
    height: 60,
    backgroundColor: colors.grey5,
    borderRadius: 30,
    borderColor: colors.grey4,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    width: buttonWidth,
    position: "relative",
  },
  swipeButton: {
    position: "absolute",
    left: 0,
    height: 60,
    width: 60,
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
