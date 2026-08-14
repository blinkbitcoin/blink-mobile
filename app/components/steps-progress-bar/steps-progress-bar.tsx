import React from "react"
import { TextStyle, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { SegmentedProgressBar } from "@app/components/segmented-progress-bar"

type StepsProgressBarProps = {
  steps: string[]
  currentStep: number
}

const TextAlign = {
  Left: "left",
  Center: "center",
  Right: "right",
} as const

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
      <SegmentedProgressBar
        total={steps.length}
        filled={currentStep}
        fillColor={colors.primary}
      />
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
