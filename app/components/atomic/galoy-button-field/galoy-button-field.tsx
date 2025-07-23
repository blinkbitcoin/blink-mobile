import React from "react"
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from "react-native"

import { useTheme, Text, makeStyles } from "@rn-vui/themed"

import { GaloyIcon } from "../galoy-icon"

export type GaloyButtonFieldProps = {
  placeholder?: string
  value?: string
  iconName?: "pencil" | "info"
  error?: boolean
  disabled?: boolean
  secondaryValue?: string
  style?: StyleProp<ViewStyle>
  highlightEnding?: boolean
} & PressableProps

export const GaloyButtonField = ({
  placeholder,
  value,
  iconName,
  error,
  disabled,
  secondaryValue,
  style,
  highlightEnding,
  ...props
}: GaloyButtonFieldProps) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const pressableStyle = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => {
    let colorStyles = {}
    switch (true) {
      case error:
        colorStyles = {
          backgroundColor: colors.error9,
        }
        break
      case pressed:
        colorStyles = {
          backgroundColor: colors.primary4,
        }
        break
      case disabled:
        colorStyles = {
          opacity: 0.3,
          backgroundColor: colors.primary5,
        }
        break
      default:
        colorStyles = {
          backgroundColor: colors.primary5,
        }
    }

    const sizeStyles = {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      minHeight: secondaryValue ? 60 : 40,
    }

    return [style, colorStyles, sizeStyles]
  }

  const primaryText = value || placeholder || ""

  const indexToStartHighlight = primaryText.length - (highlightEnding ? 5 : 0)

  return (
    <Pressable {...props} style={pressableStyle} disabled={disabled}>
      <View style={styles.contentContainerStyle}>
        <Text
          type="p1"
          color={error ? colors.error : undefined}
          style={styles.primaryTextStyle}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {primaryText.slice(0, indexToStartHighlight)}
          <Text type="p1" color={error ? colors.error : undefined} bold>
            {primaryText.slice(indexToStartHighlight)}
          </Text>
        </Text>
        {iconName && (
          <GaloyIcon
            style={styles.iconStyle}
            name={iconName}
            size={20}
            color={error ? colors.error : colors.primary}
          />
        )}
      </View>
      {secondaryValue && (
        <Text type="p4" color={error ? colors.error : undefined}>
          {secondaryValue}
        </Text>
      )}
    </Pressable>
  )
}

const useStyles = makeStyles(() => ({
  contentContainerStyle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconStyle: {
    marginLeft: 8,
    flex: 1,
  },
  primaryTextStyle: {
    flex: 1,
  },
}))
