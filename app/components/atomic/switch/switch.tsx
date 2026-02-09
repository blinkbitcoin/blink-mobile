import React from "react"
import { Pressable, ViewStyle } from "react-native"
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { makeStyles, useTheme } from "@rn-vui/themed"

const TRACK_WIDTH = 51
const TRACK_HEIGHT = 31
const THUMB_SIZE = 27
const THUMB_OFFSET = 2
const ANIMATION_DURATION = 150

type SwitchProps = {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  style?: ViewStyle
  testID?: string
}

export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  style,
  testID,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const progress = useSharedValue(value ? 1 : 0)

  React.useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: ANIMATION_DURATION })
  }, [value, progress])

  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value)
    }
  }

  const animatedTrackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [colors.grey4, colors.primary],
    )
    return {
      backgroundColor,
    }
  })

  const animatedThumbStyle = useAnimatedStyle(() => {
    const translateX = progress.value * (TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2)
    return {
      transform: [{ translateX }],
    }
  })

  return (
    <Pressable onPress={handlePress} disabled={disabled} style={style} testID={testID}>
      <Animated.View
        style={[styles.track, animatedTrackStyle, disabled && styles.trackDisabled]}
      >
        <Animated.View style={[styles.thumb, animatedThumbStyle]} />
      </Animated.View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: "center",
    paddingHorizontal: THUMB_OFFSET,
  },
  trackDisabled: {
    opacity: 0.5,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors._white,
    shadowColor: colors._black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    elevation: 4,
  },
}))
