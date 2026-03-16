import React from "react"
import { View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

// Archive: Previously, hidden balances were displayed as <Text>****</Text>
// (four asterisk characters). This was replaced with four solid filled circles
// to match the updated design spec.

type Props = {
  size: "large" | "small"
}

const CIRCLE_SIZES = {
  large: { diameter: 17, gap: 5 },
  small: { diameter: 12, gap: 3 },
} as const

export const HiddenBalanceIndicator: React.FC<Props> = ({ size }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { diameter, gap } = CIRCLE_SIZES[size]

  return (
    <View style={[styles.container, { gap }]}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: colors.grey4,
          }}
        />
      ))}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
}))
