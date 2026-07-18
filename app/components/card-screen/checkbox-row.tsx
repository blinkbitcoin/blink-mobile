import * as React from "react"
import { View } from "react-native"

import { CheckBox, makeStyles } from "@rn-vui/themed"

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

  return (
    <View style={styles.checkboxRow}>
      <CheckBox
        checked={checked}
        iconType="ionicon"
        checkedIcon={"checkbox"}
        uncheckedIcon={"square-outline"}
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
    alignItems: "flex-start",
  },
  checkboxStyle: {
    padding: 0,
    margin: 0,
    marginRight: 15,
    marginLeft: 0,
  },
  textContainer: {
    flex: 1,
  },
}))
