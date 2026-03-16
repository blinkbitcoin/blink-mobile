import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"

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

type IconProps = {
  rightIcon?: IconNamesType
}

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
  error?: boolean
  required?: boolean
  minLength?: number
  validate?: (value: string) => string | undefined
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
  onPress,
  onChangeText,
  onBlur,
  editable,
  placeholder,
  valueStyle = ValueStyle.Bold,
  size = InputSize.Default,
  helperText,
  error = false,
  required = false,
  minLength,
  validate,
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
  const { LL } = useI18nContext()

  const isEditable = editable || onBlur !== undefined || onChangeText !== undefined

  const [internalValue, setInternalValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [hasBlurred, setHasBlurred] = useState(false)
  const [hasTyped, setHasTyped] = useState(false)

  const validateRef = useRef(validate)
  validateRef.current = validate

  useEffect(() => {
    if (!isFocused && !disabled) {
      setInternalValue(value)
    }
  }, [value, isFocused, disabled])

  const validationError = useMemo(() => {
    if (!hasBlurred && !hasTyped) return undefined

    const trimmed = (isEditable ? internalValue : value).trim()
    if (required && trimmed.length === 0) return LL.common.validation.required()
    if (minLength && trimmed.length > 0 && trimmed.length < minLength)
      return LL.common.validation.minChars({ min: minLength })
    if (validateRef.current) return validateRef.current(trimmed)
    return undefined
  }, [hasBlurred, hasTyped, isEditable, internalValue, value, required, minLength, LL])

  const displayHelperText = validationError ?? helperText
  const isError = Boolean(validationError) || error

  const rightIconElement = rightIcon ? (
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
              setHasTyped(true)
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
              setHasBlurred(true)
              onBlur?.(internalValue)
            }}
          />
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            rightIconElement
          )}
        </View>
        <View style={styles.helperTextContainer}>
          {displayHelperText ? (
            <View style={styles.helperTextRow}>
              {isError && <GaloyIcon name="warning" size={12} color={colors.error} />}
              <Text style={[styles.helperText, isError && styles.helperTextError]}>
                {displayHelperText}
              </Text>
            </View>
          ) : null}
        </View>
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
      {helperText ? (
        <Text style={[styles.helperText, isError && styles.helperTextError]}>
          {helperText}
        </Text>
      ) : null}
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
    helperTextError: {
      color: colors.error,
    },
    helperTextContainer: {
      minHeight: 13,
    },
    helperTextRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
  }
})
