import React, { forwardRef, useImperativeHandle, useCallback, useEffect } from "react"
import {
  View,
  TextInput,
  NativeSyntheticEvent,
  TextInputFocusEventData,
  TargetedEvent,
  TouchableOpacity,
  Animated,
  StyleProp,
  ViewStyle,
} from "react-native"
import { Input, Text, useTheme, makeStyles } from "@rneui/themed"

import { testProps } from "@app/utils/testProps"

type AnimatedViewStyle = Animated.WithAnimatedValue<StyleProp<ViewStyle>>

type CurrencyInputProps = {
  placeholder?: string
  currency: string
  value?: string
  inputRef?: React.RefObject<TextInput>
  onChangeText: (text: string) => void
  onFocus?: ((e: NativeSyntheticEvent<TextInputFocusEventData>) => void) &
    ((event: NativeSyntheticEvent<TargetedEvent>) => void)
  isFocused?: boolean
  testId?: string
  AnimatedViewStyle?: AnimatedViewStyle
}

export const CurrencyInput = forwardRef<TextInput, CurrencyInputProps>(
  (
    {
      placeholder,
      currency,
      value,
      inputRef,
      onChangeText,
      onFocus,
      testId,
      isFocused = false,
      AnimatedViewStyle,
    },
    ref,
  ) => {
    const {
      theme: { colors },
    } = useTheme()
    const styles = useStyles(isFocused)

    useImperativeHandle(ref, () => inputRef?.current as TextInput)

    const getEndSelection = useCallback(() => {
      const text = value ?? ""
      const pos = text.length
      return { start: pos, end: pos } as const
    }, [value])

    const handleFocus = useCallback(() => inputRef?.current?.focus(), [inputRef])

    useEffect(() => {
      if (isFocused) handleFocus()
    }, [handleFocus, isFocused])

    return (
      <Animated.View style={[styles.containerBase, AnimatedViewStyle]}>
        <View style={styles.contentContainer}>
          <View style={styles.inputSection}>
            <Input
              ref={inputRef}
              value={value}
              onFocus={onFocus}
              onChangeText={onChangeText}
              showSoftInputOnFocus={false}
              inputStyle={styles.inputText}
              placeholder={placeholder}
              placeholderTextColor={colors.grey3}
              inputContainerStyle={styles.inputContainer}
              renderErrorMessage={false}
              selection={getEndSelection()}
              pointerEvents="none"
              {...(testId ? testProps(testId) : {})}
            />
            <TouchableOpacity
              style={styles.inputOverlay}
              activeOpacity={1}
              onPress={handleFocus}
            />
          </View>

          <View style={styles.currencyBadge}>
            <Text
              type="p2"
              numberOfLines={1}
              ellipsizeMode="middle"
              style={styles.currencyText}
            >
              {currency}
            </Text>
          </View>
        </View>
      </Animated.View>
    )
  },
)

CurrencyInput.displayName = "CurrencyInput"

const useStyles = makeStyles(({ colors }) => ({
  containerBase: {
    paddingVertical: 10,
    paddingRight: 15,
    paddingLeft: 5,
    borderRadius: 13,
    backgroundColor: colors.grey5,
    justifyContent: "center",
  },
  contentContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputSection: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  inputOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  inputText: {
    fontSize: 20,
    lineHeight: 24,
    flex: 1,
    padding: 0,
    margin: 0,
  },
  inputContainer: {
    borderBottomWidth: 0,
  },
  rightIconBox: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  rightIconSpacer: {
    width: 30,
    height: 30,
  },
  currencyBadge: {
    borderColor: colors.grey2,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  currencyText: {
    color: colors.grey2,
  },
}))
