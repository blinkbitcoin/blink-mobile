import React from "react"
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from "react-native"

import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  GaloyIcon,
  IconNamesType,
  IconWeight,
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
  weight?: IconWeight
  /** Minimum touch box, in dp, for a button without text. The box grows around the
   *  icon and negative margins take the growth back, so the button keeps its place
   *  and footprint. Unlike `hitSlop`, it is part of the layout, so a touch outside
   *  the parent's bounds still reaches it. */
  touchSize?: number
}

const sizeMapping = {
  small: 16,
  medium: 24,
  large: 36,
}

type MarginSide = "Top" | "Right" | "Bottom" | "Left"

/** The caller's own margins stay: the growth comes off each side on top of them. */
const touchAreaStyle = (
  contentSize: number,
  touchSize: number,
  style: StyleProp<ViewStyle>,
): StyleProp<ViewStyle> => {
  const box = Math.max(contentSize, touchSize)
  const growth = (box - contentSize) / 2
  const flat = StyleSheet.flatten(style) ?? {}
  const margin = (side: MarginSide) => {
    const axis =
      side === "Left" || side === "Right" ? flat.marginHorizontal : flat.marginVertical
    const value = flat[`margin${side}`] ?? axis ?? flat.margin ?? 0
    return (typeof value === "number" ? value : 0) - growth
  }

  return [
    style,
    {
      width: box,
      height: box,
      alignItems: "center",
      justifyContent: "center",
      marginTop: margin("Top"),
      marginRight: margin("Right"),
      marginBottom: margin("Bottom"),
      marginLeft: margin("Left"),
    },
  ]
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
  weight,
  touchSize,
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

  const callerStyle = remainingProps.style
  const touchArea =
    !text && touchSize !== undefined && typeof callerStyle !== "function"
      ? touchAreaStyle(iconContainerSize, touchSize, callerStyle)
      : undefined

  return (
    <Pressable
      hitSlop={text ? 0 : iconContainerSize / 2}
      style={text ? styles.pressableWithText : styles.pressableWithIcon}
      disabled={isDisabled}
      {...testProps(testPropId)}
      {...remainingProps}
      {...(touchArea && { style: touchArea })}
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
                weight={weight}
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
