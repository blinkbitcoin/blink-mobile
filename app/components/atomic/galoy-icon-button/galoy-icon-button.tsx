import React from "react"
import { Pressable, PressableProps, TextStyle, ViewStyle, StyleProp } from "react-native"

import { testProps } from "@app/utils/testProps"
import { useTheme, Text } from "@rn-vui/themed"

import {
  GaloyIcon,
  IconNamesType,
  circleDiameterThatContainsSquare,
} from "../galoy-icon/galoy-icon"

export type GaloyIconButtonProps = {
  name: IconNamesType
  size: "small" | "medium" | "large"
  text?: string
  iconOnly?: boolean
  color?: string
  backgroundColor?: string
}

const sizeMapping = {
  small: 16,
  medium: 24,
  large: 36,
}

export const GaloyIconButton = ({
  size,
  name,
  text,
  iconOnly,
  disabled,
  color,
  backgroundColor,
  ...remainingProps
}: GaloyIconButtonProps & PressableProps) => {
  const {
    theme: { colors },
  } = useTheme()

  const iconContainerSize = circleDiameterThatContainsSquare(sizeMapping[size])

  const pressableStyle = (): StyleProp<ViewStyle> => {
    if (text) {
      return {
        alignItems: "center",
      }
    }

    return {
      width: iconContainerSize,
      height: iconContainerSize,
    }
  }

  const iconProps = (pressed: boolean, iconOnly: boolean, disabled: boolean) => {
    switch (true) {
      case iconOnly && disabled:
        return {
          opacity: 0.7,
          color: color || colors.primary,
          backgroundColor: colors.transparent,
        }
      case iconOnly && pressed:
        return {
          opacity: 0.7,
          color: color || colors.primary,
          backgroundColor: backgroundColor || colors.grey4,
        }
      case iconOnly && !pressed:
        return {
          color: color || colors.primary,
          backgroundColor: colors.transparent,
        }
      case !iconOnly && disabled:
        return {
          opacity: 0.7,
          color: color || colors.primary,
          backgroundColor: backgroundColor || colors.grey4,
        }
      case !iconOnly && pressed:
        return {
          opacity: 0.7,
          color: color || colors.primary,
          backgroundColor: backgroundColor || colors.grey4,
        }
      case !iconOnly && !pressed:
        return {
          color: color || colors.primary,
          backgroundColor: backgroundColor || colors.grey4,
        }
      default:
        return {}
    }
  }

  const fontStyle = (disabled: boolean): StyleProp<TextStyle> => {
    return {
      marginTop: 8,
      opacity: disabled ? 0.7 : 1,
      textAlign: "center",
      fontSize: 11,
    }
  }

  const testPropId = text || name

  return (
    <Pressable
      hitSlop={text ? 0 : iconContainerSize / 2}
      style={pressableStyle}
      disabled={disabled}
      {...testProps(testPropId)}
      {...remainingProps}
    >
      {({ pressed }) => {
        return (
          <>
            <GaloyIcon
              name={name}
              size={sizeMapping[size]}
              {...iconProps(pressed, Boolean(iconOnly), Boolean(disabled))}
            />
            {text && <Text style={fontStyle(Boolean(disabled))}>{text}</Text>}
          </>
        )
      }}
    </Pressable>
  )
}

export const GaloyEditButton = ({ disabled, ...remainingProps }: PressableProps) => {
  const {
    theme: { colors },
  } = useTheme()
  const pressableStyle = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => {
    return {
      width: 32,
      height: 32,
      borderRadius: 8,
      opacity: disabled ? 0.7 : 1,
      backgroundColor: pressed ? colors.grey4 : colors.grey5,
      alignItems: "center",
      justifyContent: "center",
    }
  }

  return (
    <Pressable
      {...remainingProps}
      hitSlop={16}
      style={pressableStyle}
      disabled={disabled}
    >
      {({ pressed }) => (
        <GaloyIcon
          name="pencil"
          size={20}
          color={colors.primary}
          opacity={pressed ? 0.7 : 1}
        />
      )}
    </Pressable>
  )
}
