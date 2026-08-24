import React from "react"
import { Text, View } from "react-native"
import { MAX_FONT_SIZE_MULTIPLIER } from "@app/rne-theme/text-scaling"

import { makeStyles } from "@rn-vui/themed"

type NumberedStepsListProps = {
  steps: ReadonlyArray<React.ReactNode>
}

export const NumberedStepsList: React.FC<NumberedStepsListProps> = ({ steps }) => {
  const styles = useStyles()

  return (
    <View style={styles.container}>
      {steps.map((content, index) => (
        <View key={index} style={styles.row}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={[styles.base, styles.number]}
          >{`${index + 1}.`}</Text>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={[styles.base, styles.text]}
          >
            {content}
          </Text>
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: 4,
    paddingTop: 14,
  },
  row: {
    flexDirection: "row",
  },
  base: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
    color: colors.black,
  },
  number: {
    width: 20,
  },
  text: {
    flex: 1,
  },
}))
