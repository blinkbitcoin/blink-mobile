import React from "react"
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"
import { useTheme, Text, makeStyles } from "@rn-vui/themed"

export type AmountInputButtonProps = {
  placeholder?: string
  value?: string
  iconName?: "pencil" | "info"
  error?: boolean
  disabled?: boolean
  secondaryValue?: string
  primaryTextTestProps?: string
  showValuesIfDisabled?: boolean
  big?: boolean
} & PressableProps

export const AmountInputButton: React.FC<AmountInputButtonProps> = ({
  placeholder,
  value,
  iconName,
  error,
  disabled,
  secondaryValue,
  primaryTextTestProps,
  showValuesIfDisabled = true,
  big = true,
  ...props
}) => {
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
          opacity: 0.5,
          backgroundColor: colors.grey5,
        }
        break
      case disabled:
        colorStyles = {
          backgroundColor: colors.grey5,
          opacity: 0.5,
        }
        break
      default:
        colorStyles = {
          backgroundColor: colors.grey5,
        }
    }

    const sizeStyles = {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      minHeight: big ? 60 : 50,
      justifyContent: "center",
    }

    return [colorStyles, sizeStyles]
  }

  /* eslint-disable no-param-reassign */
  // hide values if disabled
  if (!showValuesIfDisabled) {
    value = ""
    secondaryValue = ""
  }

  const primaryText = value || placeholder || ""

  return (
    <Pressable {...props} style={pressableStyle} disabled={disabled}>
      <View style={styles.contentContainerStyle}>
        <Text
          type="p2"
          color={error ? colors.error : undefined}
          numberOfLines={1}
          ellipsizeMode="middle"
          {...(primaryTextTestProps ? testProps(primaryTextTestProps) : {})}
        >
          {primaryText}
        </Text>
        {iconName && (
          <GaloyIcon
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
}))
