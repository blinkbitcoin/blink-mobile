import * as React from "react"
import { View } from "react-native"
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated"

import { makeStyles } from "@rn-vui/themed"

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors._white,
    borderRadius: 50,
    overflow: "hidden",
  },
  animatedStyle: {
    borderRadius: 50,
    flex: 1,
  },
}))

export const PaginationItem: React.FC<{
  index: number
  backgroundColor: string
  length: number
  animValue: Animated.SharedValue<number>
  isRotate?: boolean
}> = (props) => {
  const styles = useStyles()

  const { animValue, index, length, backgroundColor, isRotate } = props
  const width = 10
  const containerDynamicStyle = {
    height: width,
    width,
    transform: [
      {
        rotateZ: isRotate ? "90deg" : "0deg",
      },
    ],
  }

  // not sure why it's needed. maybe need to look into when upgrading react native reanimated
  /* eslint @typescript-eslint/ban-ts-comment: "off" */
  // @ts-ignore-next-line
  const animStyle = useAnimatedStyle(() => {
    let inputRange = [index - 1, index, index + 1]
    let outputRange = [-width, 0, width]

    if (index === 0 && animValue?.value > length - 1) {
      inputRange = [length - 1, length, length + 1]
      outputRange = [-width, 0, width]
    }

    return {
      transform: [
        {
          translateX: interpolate(
            animValue?.value,
            inputRange,
            outputRange,
            Extrapolate.CLAMP,
          ),
        },
      ],
    }
  }, [animValue, index, length])
  return (
    <View style={[styles.container, containerDynamicStyle]}>
      <Animated.View style={[styles.animatedStyle, { backgroundColor }, animStyle]} />
    </View>
  )
}
