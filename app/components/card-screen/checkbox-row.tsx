import * as React from "react"
import { View } from "react-native"

import { CheckBox, makeStyles, useTheme } from "@rn-vui/themed"

type CheckboxRowProps = {
  checked: boolean
  onPress: () => void
  children: React.ReactNode
}

export const CheckboxRow: React.FC<CheckboxRowProps> = ({
  checked,
  onPress,
  children,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.checkboxRow}>
      <CheckBox
        checked={checked}
        iconType="ionicon"
        checkedIcon={"checkbox"}
        uncheckedIcon={"square-outline"}
        uncheckedColor={colors.textDisabled}
        onPress={onPress}
        containerStyle={styles.checkboxStyle}
      />
      <View style={styles.textContainer}>{children}</View>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  /** The icon's glyph sits inset in its box, so 12 leaves the design's 14 between the
   *  drawn box and the text. Transparent, since the design draws the box straight on
   *  the screen. */
  checkboxStyle: {
    backgroundColor: "transparent",
    padding: 0,
    margin: 0,
    marginRight: 12,
    marginLeft: 0,
  },
  textContainer: {
    flex: 1,
  },
}))
