import React, { useEffect, useRef } from "react"
import { Animated, TextStyle, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

type StepsProgressBarProps = {
  steps: string[]
  currentStep: number
}

type AnimatedBarProps = {
  isActive: boolean
  activeColor: string
  inactiveColor: string
}

const TextAlign = {
  Left: "left",
  Center: "center",
  Right: "right",
} as const

const ANIMATION_DURATION = 120

const AnimatedBar: React.FC<AnimatedBarProps> = ({
  isActive,
  activeColor,
  inactiveColor,
}) => {
  const styles = useStyles()
  const widthAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: isActive ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: false,
    }).start()
  }, [isActive, widthAnim])

  return (
    <View style={[styles.bar, { backgroundColor: inactiveColor }]}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: activeColor,
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  )
}

export const StepsProgressBar: React.FC<StepsProgressBarProps> = ({
  steps,
  currentStep,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const getTextAlign = (index: number): TextStyle["textAlign"] => {
    if (index === 0) return TextAlign.Left
    if (index === steps.length - 1) return TextAlign.Right
    return TextAlign.Center
  }

  return (
    <View style={styles.container}>
      <View style={styles.barsContainer}>
        {steps.map((_, index) => (
          <AnimatedBar
            key={`bar-${index}`}
            isActive={index < currentStep}
            activeColor={colors.primary}
            inactiveColor={colors.grey4}
          />
        ))}
      </View>
      <View style={styles.labelsContainer}>
        {steps.map((label, index) => (
          <Text
            key={`label-${index}`}
            style={[styles.label, { textAlign: getTextAlign(index) }]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    width: "100%",
  },
  barsContainer: {
    flexDirection: "row",
    width: "100%",
  },
  bar: {
    flex: 1,
    height: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
  },
  labelsContainer: {
    flexDirection: "row",
    marginTop: 8,
  },
  label: {
    flex: 1,
    fontFamily: "Source Sans Pro",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "400",
    color: colors.grey2,
  },
}))
