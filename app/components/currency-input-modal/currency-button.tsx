import React, { forwardRef, useImperativeHandle, useRef } from "react"
import {
  NativeSyntheticEvent,
  PressableProps,
  TargetedEvent,
  TextInput,
  TextInputFocusEventData,
  View,
} from "react-native"

import { testProps } from "@app/utils/testProps"
import { useTheme, Text, makeStyles, Input } from "@rneui/themed"

export type CurrencyModalButtonProps = {
  placeholder?: string
  selectedCurrency: string
  inputValue?: string
  iconName?: "pencil" | "info"
  primaryTextTestProps?: string
  onChangeText: (text: string) => void
  onFocus: ((e: NativeSyntheticEvent<TextInputFocusEventData>) => void) &
    ((event: NativeSyntheticEvent<TargetedEvent>) => void)
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
    },
    ref,
  ) => {
    const {
      theme: { colors },
    } = useTheme()
    const styles = useStyles()
    const inputRef = useRef<TextInput>(null)

    useImperativeHandle(ref, () => inputRef.current as TextInput)

    return (
      <View style={[styles.pressableBase, styles.defaultBackground]}>
        <View style={styles.contentContainerStyle}>
          <View
            style={{
              flexDirection: "row",
              flex: 1,
              alignItems: "center",
            }}
          >
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
              {...(primaryTextTestProps ? testProps(primaryTextTestProps) : {})}
            />
          </View>

          <View
            style={{
              borderColor: colors._white,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 10,
            }}
          >
            <Text
              type="p2"
              numberOfLines={1}
              ellipsizeMode="middle"
              style={{ fontWeight: "bold" }}
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

const useStyles = makeStyles(({ colors }) => ({
  contentContainerStyle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pressableBase: {
    paddingVertical: 7,
    paddingHorizontal: 15,
    borderRadius: 13,
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
  primaryNumberContainer: {
    flex: 1,
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
  amountValueStyle: {
    marginLeft: 11,
  },
}))
