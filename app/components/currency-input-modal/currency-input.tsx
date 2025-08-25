import * as React from "react"

import { testProps } from "@app/utils/testProps"

import { CurrencyModalButton } from "./currency-button"
import {
  NativeSyntheticEvent,
  TargetedEvent,
  TextInput,
  TextInputFocusEventData,
} from "react-native"
import { forwardRef } from "react"

export type CurrencyInputModalProps = {
  defaultCurrency: string
  placeholder: string
  inputValue?: string
  onChangeText: (text: string) => void
  onFocus: ((e: NativeSyntheticEvent<TextInputFocusEventData>) => void) &
    ((event: NativeSyntheticEvent<TargetedEvent>) => void)
}

export const CurrencyInputModal = forwardRef<TextInput, CurrencyInputModalProps>(
  (
    {
      defaultCurrency,
      inputValue,
      placeholder,
      onChangeText,
      onFocus,
    },
    ref,
  ) => {

    return (
      <CurrencyModalButton
        ref={ref}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        selectedCurrency={defaultCurrency}
        inputValue={inputValue}
        iconName="pencil"
        primaryTextTestProps={"Expiration time input button"}
        {...testProps("Expiration time button")}
      />
    )
  },
)
