import React from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { makeStyles, useTheme } from "@rneui/themed"
import { FieldWithIconProps } from "./field-with-icon.props"

export const FieldWithIconEvent = ({
  text,
  event,
  iconName,
  accessibilityLabel,
}: FieldWithIconProps) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.successActionFieldContainer}>
      <Text style={styles.disabledFieldBackground}>{text}</Text>
      <TouchableOpacity
        style={styles.iconContainer}
        onPress={event}
        accessibilityLabel={accessibilityLabel}
        hitSlop={30}
      >
        <GaloyIcon name={iconName} size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  successActionFieldContainer: {
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    alignItems: "center",
    padding: 14,
    minHeight: 60,
    marginBottom: 12,
  },
  disabledFieldBackground: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    fontSize: 14,
    color: colors.black,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 20,
  },
}))
