import React from "react"
import { StyleProp, View, ViewStyle } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { testProps } from "@app/utils/testProps"

export type StatusPillVariant = "warning" | "error" | "success" | "primary"

type Props = {
  label: string
  status: StatusPillVariant
  ghost?: boolean
  testID?: string
  style?: StyleProp<ViewStyle>
}

export const StatusPill: React.FC<Props> = ({ label, status, ghost, testID, style }) => {
  const styles = useStyles({ status })

  const body = <Text style={styles.label}>{label}</Text>

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
