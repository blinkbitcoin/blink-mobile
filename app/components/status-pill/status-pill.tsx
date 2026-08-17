import React from "react"
import { Pressable, StyleProp, View, ViewStyle } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { testProps } from "@app/utils/testProps"

export type StatusPillVariant = "warning" | "error" | "success" | "primary"

/** The pill can sit in width-capped rows (balance header), so its label must
 *  not outgrow the cap under iOS Dynamic Type — same ceiling as the header. */
const MAX_LABEL_FONT_SIZE_MULTIPLIER = 1.4

type Props = {
  label: string
  status: StatusPillVariant
  ghost?: boolean
  testID?: string
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}

export const StatusPill: React.FC<Props> = ({
  label,
  status,
  ghost,
  testID,
  style,
  onPress,
}) => {
  const styles = useStyles({ status })

  const body = (
    <Text
      style={styles.label}
      numberOfLines={1}
      ellipsizeMode="tail"
      maxFontSizeMultiplier={MAX_LABEL_FONT_SIZE_MULTIPLIER}
    >
      {label}
    </Text>
  )

  if (ghost) {
    return (
      <View
        style={[styles.pill, styles.ghost, style]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {body}
      </View>
    )
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={[styles.pill, style]}
        {...(testID ? testProps(testID) : { accessibilityLabel: label })}
      >
        {body}
      </Pressable>
    )
  }

  return (
    <View style={[styles.pill, style]} {...(testID ? testProps(testID) : {})}>
      {body}
    </View>
  )
}

const useStyles = makeStyles(({ colors }, { status }: { status: StatusPillVariant }) => ({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors[status],
  },
  ghost: {
    opacity: 0,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.black,
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
}))
