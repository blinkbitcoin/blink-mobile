import React from "react"
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

export type GaloyTertiaryButtonProps = {
  outline?: boolean
  clear?: boolean
  containerStyle?: StyleProp<ViewStyle>
  title: string
  icon?: JSX.Element
} & PressableProps

export const GaloyTertiaryButton = (props: GaloyTertiaryButtonProps) => {
  const { outline, clear, containerStyle, disabled, icon, ...remainingProps } = props
  const styles = useStyles(props)
  const {
    theme: { colors },
  } = useTheme()

  const pressableStyle = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => {
    let dynamicStyle
    switch (true) {
      case pressed && outline:
        dynamicStyle = {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
          borderWidth: 1.5,
        }
        break
      case pressed && !outline && !clear:
        dynamicStyle = {
          backgroundColor: colors.primary,
        }
        break
      case pressed && clear:
        dynamicStyle = {
          opacity: 0.7,
        }
        break
      case outline:
        dynamicStyle = {
          opacity: disabled ? 0.7 : 1,
          backgroundColor: colors.transparent,
          borderColor: colors.primary,
          borderWidth: 1.5,
        }
        break
      case clear:
        dynamicStyle = {
          backgroundColor: colors.transparent,
        }
        break
      default:
        dynamicStyle = {
          backgroundColor: colors.primary,
        }
    }

    return [dynamicStyle, containerStyle, styles.pressableStyle]
  }

  let textColor = colors.white
  if (outline) textColor = colors.black
  if (clear) textColor = colors.primary

  return (
    <Pressable {...remainingProps} style={pressableStyle} disabled={disabled}>
      <View style={styles.container}>
        <Text color={textColor} style={styles.buttonTitleStyle}>
          {props.title}
        </Text>
        {icon ? icon : null}
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles((_, props: GaloyTertiaryButtonProps) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonTitleStyle: {
    lineHeight: 20,
    textAlign: "center",
    fontSize: 14,
    fontWeight: props.clear ? "bold" : "600",
    opacity: props.disabled ? 0.7 : 1,
  },

  pressableStyle: {
    paddingHorizontal: props.clear ? 0 : 16,
    paddingVertical: props.clear ? 0 : 4,
    borderRadius: 50,
  },
}))
