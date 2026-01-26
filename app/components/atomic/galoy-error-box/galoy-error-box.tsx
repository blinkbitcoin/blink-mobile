import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../galoy-icon"

type GaloyErrorBoxProps = {
  errorMessage: string
  noIcon?: boolean
}

export const GaloyErrorBox: React.FC<GaloyErrorBoxProps> = ({ errorMessage, noIcon }) => {
  const {
    theme: { colors, mode },
  } = useTheme()
  const styles = useStyles()

  const color = mode === "light" ? colors.error : colors.black

  return (
    <View style={styles.container}>
      {!noIcon && <GaloyIcon name="warning" size={14} color={color} />}
      <Text style={styles.textContainer} type={"p3"} color={color}>
        {errorMessage}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.error9,
    zIndex: 1,
  },
  textContainer: {
    overflow: "hidden",
    marginLeft: 4,
    flex: 1,
  },
}))
