import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

export const ValueStyle = {
  Bold: "bold",
  Regular: "regular",
} as const

export type ValueStyleType = (typeof ValueStyle)[keyof typeof ValueStyle]

const InputSize = {
  Default: "default",
  Large: "large",
} as const

type InputSizeType = (typeof InputSize)[keyof typeof InputSize]

type IconProps =
  | { rightIcon?: IconNamesType; rightIonicon?: never }
  | { rightIcon?: never; rightIonicon?: string }

type InputFieldProps = {
  label: string
  value: string
  onPress?: () => void
  onChangeText?: (text: string) => void
  onBlur?: (value: string) => void
  editable?: boolean
  placeholder?: string
  valueStyle?: ValueStyleType
  size?: InputSizeType
  helperText?: string
  loading?: boolean
  disabled?: boolean
  keyboardType?: KeyboardTypeOptions
  formatDisplay?: (value: string) => string
  testID?: string
} & IconProps

type StyleProps = {
  valueStyle: ValueStyleType
  size: InputSizeType
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  rightIcon,
  rightIonicon,
  onPress,
  onChangeText,
  onBlur,
  editable,
  placeholder,
  valueStyle = ValueStyle.Bold,
  size = InputSize.Default,
  helperText,
  loading = false,
  disabled = false,
  keyboardType,
  formatDisplay,
  testID,
}) => {
  const styles = useStyles({ valueStyle, size })
  const {
    theme: { colors },
  } = useTheme()

  const isEditable = editable || onBlur !== undefined || onChangeText !== undefined

  const [internalValue, setInternalValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused && !disabled) {
      setInternalValue(value)
    }
  }, [value, isFocused, disabled])

  const rightIconElement = rightIonicon ? (
    <Icon name={rightIonicon} type="ionicon" size={20} color={colors.primary} />
  ) : rightIcon ? (
    <GaloyIcon name={rightIcon} size={20} color={colors.primary} />
  ) : null

  if (isEditable) {
    const displayValue =
      formatDisplay && !isFocused ? formatDisplay(internalValue) : internalValue

    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.valueContainer, disabled && styles.valueContainerDisabled]}>
          <TextInput
            style={[styles.value, styles.editableInput]}
            value={displayValue}
            onChangeText={(text) => {
              setInternalValue(text)
              onChangeText?.(text)
            }}
            placeholder={placeholder ?? label}
            placeholderTextColor={colors.grey3}
            selectionColor={colors.primary}
            accessibilityLabel={label}
            keyboardType={keyboardType}
            editable={!disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false)
              onBlur?.(internalValue)
            }}
          />
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            rightIconElement
          )}
        </View>
        {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
      </View>
    )
  }

  const content = (
    <View style={styles.valueContainer}>
      <Text style={styles.value}>{value}</Text>
      {rightIconElement}
    </View>
  )

  const pressableContent = onPress ? (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </TouchableOpacity>
  ) : (
    content
  )

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {pressableContent}
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors }, { valueStyle, size }: StyleProps) => {
  const isBold = valueStyle === ValueStyle.Bold
  const isLarge = size === InputSize.Large

  return {
    container: {
      gap: 3,
    },
    label: {
      color: colors.black,
      fontSize: 14,
      fontFamily: "Source Sans Pro",
      fontWeight: "400",
      lineHeight: 20,
    },
    valueContainer: {
      backgroundColor: colors.grey5,
      borderRadius: 8,
      minHeight: isLarge ? 52 : 50,
      paddingLeft: 14,
      paddingRight: 10,
      paddingVertical: isLarge ? 14 : 5,
      justifyContent: "center",
      flexDirection: "row",
      alignItems: "center",
    },
    valueContainerDisabled: {
      opacity: 0.5,
    },
    value: {
      flex: 1,
      color: isLarge || isBold ? colors.black : colors.grey2,
      fontSize: isLarge ? 18 : isBold ? 14 : 16,
      fontFamily: "Source Sans Pro",
      fontWeight: isLarge ? "400" : isBold ? "700" : "400",
      lineHeight: isLarge ? 24 : isBold ? 20 : 22,
    },
    editableInput: {
      padding: 0,
    },
    helperText: {
      color: colors.black,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "400",
    },
  }
})
