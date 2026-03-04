import React from "react"
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  View,
  ViewStyle,
  StyleProp,
} from "react-native"

import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  GaloyIcon,
  IconNamesType,
  circleDiameterThatContainsSquare,
} from "../galoy-icon/galoy-icon"

export type GaloyIconButtonProps = {
  name: IconNamesType
  size: "small" | "medium" | "large" | number
  iconSize?: number
  text?: string
  iconOnly?: boolean
  color?: string
  backgroundColor?: string
  loading?: boolean
}

const sizeMapping = {
  small: 16,
  medium: 24,
  large: 36,
}

export const GaloyIconButton = ({
  size,
  name,
  iconSize,
  text,
  iconOnly,
  disabled,
  color,
  backgroundColor,
  loading,
  ...remainingProps
}: GaloyIconButtonProps & PressableProps) => {
  const {
    theme: { colors },
  } = useTheme()

  const isDisabled = disabled || loading

  const isNumericSize = typeof size === "number"
  const resolvedIconSize = iconSize ?? (isNumericSize ? size : sizeMapping[size])
  const iconContainerSize = isNumericSize
    ? size
    : circleDiameterThatContainsSquare(resolvedIconSize)

  const styles = useStyles({
    iconContainerSize,
    isDisabled: Boolean(isDisabled),
    isIconOnly: Boolean(iconOnly),
    customBg: backgroundColor,
  })

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

  const testPropId = text || name

  return (
    <Pressable
      hitSlop={text ? 0 : iconContainerSize / 2}
      style={text ? styles.pressableWithText : styles.pressableWithIcon}
      disabled={isDisabled}
      {...testProps(testPropId)}
      {...remainingProps}
    >
      {({ pressed }) => {
        const resolvedProps = iconProps(pressed, Boolean(iconOnly), Boolean(isDisabled))

        return (
          <>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size={resolvedIconSize} color={resolvedProps.color} />
              </View>
            ) : (
              <GaloyIcon
                name={name}
                size={resolvedIconSize}
                containerSize={isNumericSize ? size : undefined}
                {...resolvedProps}
              />
            )}
            {text && (
              <Text numberOfLines={1} style={styles.label}>
                {text}
              </Text>
            )}
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

type StyleProps = {
  iconContainerSize: number
  isDisabled: boolean
  isIconOnly: boolean
  customBg?: string
}

const useStyles = makeStyles(
  ({ colors }, { iconContainerSize, isDisabled, isIconOnly, customBg }: StyleProps) => ({
    pressableWithText: {
      alignItems: "center",
    },
    pressableWithIcon: {
      width: iconContainerSize,
      height: iconContainerSize,
    },
    loadingContainer: {
      width: iconContainerSize,
      height: iconContainerSize,
      borderRadius: iconContainerSize / 2,
      backgroundColor: isIconOnly ? colors.transparent : customBg || colors.grey4,
      opacity: 0.7,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      marginTop: 8,
      opacity: isDisabled ? 0.7 : 1,
      textAlign: "center",
      fontSize: 11,
    },
  }),
)
