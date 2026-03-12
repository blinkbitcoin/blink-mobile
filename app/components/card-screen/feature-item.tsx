import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  circleDiameterThatContainsSquare,
  GaloyIcon,
  IconNamesType,
} from "@app/components/atomic/galoy-icon"

export interface Feature {
  icon: IconNamesType
  title: string
}

interface FeatureItemProps {
  feature: Feature
}

export const FeatureItem: React.FC<FeatureItemProps> = ({ feature }) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.featureContainer}>
      <GaloyIcon
        name={feature.icon}
        color={colors._black}
        backgroundColor={colors.primary}
        style={styles.iconStyle}
        size={19}
      />
      <Text type="p2">{feature.title}</Text>
    </View>
  )
}

const useStyles = makeStyles(() => {
  const containerSize = circleDiameterThatContainsSquare(22)

  return {
    featureContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 15,
    },
    iconStyle: {
      borderRadius: containerSize,
      width: containerSize,
      height: containerSize,
      alignItems: "center",
      justifyContent: "center",
    },
  }
})
