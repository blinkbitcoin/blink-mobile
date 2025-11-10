import React from "react"
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"
import { useTheme, Text, makeStyles } from "@rn-vui/themed"

export type ExpirationTimeButtonProps = {
  placeholder?: string
  value: string | number | null
  iconName?: "pencil" | "info"
  error?: boolean
  disabled?: boolean
  primaryTextTestProps?: string
  big?: boolean
  style?: StyleProp<ViewStyle>
} & PressableProps

export const ExpirationTimeButton: React.FC<ExpirationTimeButtonProps> = ({
  placeholder,
  value,
  iconName,
  error,
  disabled,
  primaryTextTestProps,
  big,
  style,
  ...props
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles({ big })

  const pressableStyle = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => {
    if (error) {
      return [styles.pressableBase, styles.errorBackground]
    }

    if (disabled || pressed) {
      return [styles.pressableBase, styles.defaultBackground, styles.interactiveOpacity]
    }

    return [styles.pressableBase, styles.defaultBackground]
  }

  return (
    <View style={style}>
      <Pressable {...props} style={pressableStyle} disabled={disabled}>
        <View style={styles.contentContainerStyle}>
          <Text
            type="p2"
            color={error ? colors.error : undefined}
            numberOfLines={1}
            ellipsizeMode="middle"
            {...(primaryTextTestProps ? testProps(primaryTextTestProps) : {})}
          >
            {`${placeholder}${!disabled && value ? ": " + value : ""}`}
          </Text>
          {iconName && (
            <GaloyIcon
              name={iconName}
              size={20}
              color={error ? colors.error : colors.primary}
            />
          )}
        </View>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors }, props: { big?: boolean }) => ({
  contentContainerStyle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pressableBase: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: props.big ? 60 : 50,
    justifyContent: "center",
  },
  defaultBackground: {
    backgroundColor: colors.grey5,
  },
  errorBackground: {
    backgroundColor: colors.error9,
  },
  interactiveOpacity: {
    opacity: 0.5,
  },
}))
