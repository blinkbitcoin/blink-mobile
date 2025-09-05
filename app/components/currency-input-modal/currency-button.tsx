import React, { forwardRef, useImperativeHandle, useRef, useCallback } from "react"
import {
  View,
  TextInput,
  PressableProps,
  NativeSyntheticEvent,
  TextInputFocusEventData,
  TargetedEvent,
  TouchableOpacity,
} from "react-native"
import { Input, Text, useTheme, makeStyles } from "@rneui/themed"

import { testProps } from "@app/utils/testProps"

export type CurrencyModalButtonProps = {
  placeholder?: string
  selectedCurrency: string
  inputValue?: string
  iconName?: "pencil" | "info"
  primaryTextTestProps?: string
  onChangeText: (text: string) => void
  onFocus: ((e: NativeSyntheticEvent<TextInputFocusEventData>) => void) &
    ((event: NativeSyntheticEvent<TargetedEvent>) => void)
  rightIcon?: React.ReactNode
} & PressableProps

export const CurrencyModalButton = forwardRef<TextInput, CurrencyModalButtonProps>(
  (
    {
      placeholder,
      selectedCurrency,
      inputValue,
      primaryTextTestProps,
      onChangeText,
      onFocus,
      rightIcon,
    },
    ref,
  ) => {
    const {
      theme: { colors },
    } = useTheme()
    const styles = useStyles()
    const inputRef = useRef<TextInput>(null)

    useImperativeHandle(ref, () => inputRef.current as TextInput)

    const resolvedRightIcon = React.isValidElement(rightIcon) ? (
      rightIcon
    ) : (
      <View style={styles.rightIconSpacer} />
    )

    const getEndSelection = useCallback(() => {
      const text = inputValue ?? ""
      const pos = text.length
      return { start: pos, end: pos } as const
    }, [inputValue])

    const handleOverlayPress = useCallback(() => {
      const text = inputValue ?? ""
      const pos = text.length
      inputRef.current?.focus()
      inputRef.current?.setNativeProps({ selection: { start: pos, end: pos } })
    }, [inputValue])

    return (
      <View style={[styles.pressableBase, styles.defaultBackground]}>
        <View style={styles.contentContainer}>
          <View style={[styles.inputRow, styles.inputWithOverlay]}>
            <Input
              ref={inputRef}
              value={inputValue}
              onFocus={onFocus}
              onChangeText={onChangeText}
              showSoftInputOnFocus={false}
              inputStyle={styles.primaryNumberText}
              placeholder={placeholder}
              placeholderTextColor={colors.grey3}
              inputContainerStyle={styles.primaryNumberInputContainer}
              renderErrorMessage={false}
              autoFocus
              rightIcon={resolvedRightIcon}
              rightIconContainerStyle={styles.rightIconContainer}
              selection={getEndSelection()}
              pointerEvents="none"
              {...(primaryTextTestProps ? testProps(primaryTextTestProps) : {})}
            />
            <TouchableOpacity
              style={styles.inputOverlay}
              activeOpacity={1}
              onPress={handleOverlayPress}
            />
          </View>

          <View style={styles.currencyBox}>
            <Text
              type="p2"
              numberOfLines={1}
              ellipsizeMode="middle"
              style={styles.currencyText}
              {...(primaryTextTestProps ? testProps(primaryTextTestProps) : {})}
            >
              {selectedCurrency}
            </Text>
          </View>
        </View>
      </View>
    )
  },
)

CurrencyModalButton.displayName = "CurrencyModalButton"

const useStyles = makeStyles(({ colors }) => ({
  pressableBase: {
    paddingVertical: 10,
    paddingRight: 15,
    paddingLeft: 5,
    borderRadius: 13,
    justifyContent: "center",
  },
  defaultBackground: { backgroundColor: colors.grey5 },
  contentContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputRow: { flexDirection: "row", flex: 1, alignItems: "center" },
  inputWithOverlay: { position: "relative" },
  inputOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  primaryNumberText: {
    fontSize: 20,
    lineHeight: 24,
    flex: 1,
    fontWeight: "600",
    padding: 0,
    margin: 0,
  },
  primaryNumberInputContainer: {
    borderBottomWidth: 0,
  },
  rightIconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  rightIconSpacer: {
    width: 30,
    height: 22,
  },
  currencyBox: {
    borderColor: colors._white,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  currencyText: {
    fontWeight: "bold",
  },
}))
