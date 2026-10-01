import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { testProps } from "@app/utils/testProps"

export type StatusPillVariant = "warning" | "error" | "success" | "primary"

/** The pill sits beside a settings row's title, which is width-capped, so its
 *  label must not outgrow that cap under iOS Dynamic Type. */
const MAX_LABEL_FONT_SIZE_MULTIPLIER = 1.4

type Props = {
  label: string
  status: StatusPillVariant
  testID?: string
}

export const StatusPill: React.FC<Props> = ({ label, status, testID }) => {
  const styles = useStyles({ status })

  return (
    <View style={styles.pill} {...(testID ? testProps(testID) : {})}>
      <Text
        style={styles.label}
        numberOfLines={1}
        ellipsizeMode="tail"
        maxFontSizeMultiplier={MAX_LABEL_FONT_SIZE_MULTIPLIER}
      >
        {label}
      </Text>
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
  label: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.black,
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
}))
