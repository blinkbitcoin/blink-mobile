import React from "react"
import { View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"

export const OptionIcon = ({
  icon,
  isSelected,
}: {
  icon?: IconNamesType
  isSelected: boolean
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  if (icon) {
    return (
      <View style={styles.iconContainer}>
        <GaloyIcon
          name={icon}
          size={24}
          color={isSelected ? colors.primary : colors.grey3}
        />
      </View>
    )
  }
}

const useStyles = makeStyles(() => ({
  iconContainer: {
    marginLeft: 16,
    alignItems: "center",
    justifyContent: "center",
  },
}))
