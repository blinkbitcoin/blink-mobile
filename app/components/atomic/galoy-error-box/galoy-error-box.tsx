import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../galoy-icon"

type GaloyErrorBoxProps = {
  errorMessage: string
  noIcon?: boolean
  /** The unfilled variant is a bare centred line, for an error that sits right above the
   *  field it is about (which carries the red outline) rather than in a box of its own. */
  filled?: boolean
}

export const GaloyErrorBox: React.FC<GaloyErrorBoxProps> = ({
  errorMessage,
  noIcon,
  filled = true,
}) => {
  const {
    theme: { colors, mode },
  } = useTheme()
  const styles = useStyles()

  if (!filled) {
    return (
      <View style={styles.unfilledContainer}>
        {!noIcon && <GaloyIcon name="info" size={16} color={colors.error} />}
        <Text style={styles.unfilledText} type="p3" color={colors.error}>
          {errorMessage}
        </Text>
      </View>
    )
  }

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
  unfilledContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    paddingVertical: 3,
  },
  unfilledText: {
    flexShrink: 1,
    textAlign: "center",
    lineHeight: 20,
  },
}))
