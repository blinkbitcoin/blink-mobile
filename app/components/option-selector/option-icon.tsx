import React from "react"
import { View } from "react-native"
import { makeStyles, useTheme, Icon } from "@rn-vui/themed"
import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"

export const OptionIcon = ({
  ionicon,
  icon,
  isSelected,
}: {
  ionicon?: string
  icon?: IconNamesType
  isSelected: boolean
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  if (ionicon) {
    return (
      <View style={styles.iconContainer}>
        <Icon
          name={ionicon}
          size={24}
          type="ionicon"
          color={isSelected ? colors.primary : colors.grey3}
        />
      </View>
    )
  }

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
