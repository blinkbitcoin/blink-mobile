import React, { forwardRef } from "react"
import {
  View,
  TextInput,
  NativeSyntheticEvent,
  TextInputFocusEventData,
  TargetedEvent,
} from "react-native"
import { makeStyles } from "@rneui/themed"

import { testProps } from "@app/utils/testProps"

import { CurrencyModalButton } from "./currency-button"

export type CurrencyInputModalProps = {
  defaultCurrency: string
  placeholder: string
  inputValue?: string
  onChangeText: (text: string) => void
  onFocus: ((e: NativeSyntheticEvent<TextInputFocusEventData>) => void) &
    ((event: NativeSyntheticEvent<TargetedEvent>) => void)
  rightIcon?: React.ReactNode
}

export const CurrencyInputModal = forwardRef<TextInput, CurrencyInputModalProps>(
  (
    { defaultCurrency, inputValue, placeholder, onChangeText, onFocus, rightIcon },
    ref,
  ) => {
    const styles = useStyles()

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
        rightIcon={
          rightIcon ? (
            <View style={styles.rightIconBox}>{rightIcon}</View>
          ) : (
            <View style={styles.rightIconSpacer} />
          )
        }
        {...testProps("Expiration time button")}
      />
    )
  },
)

CurrencyInputModal.displayName = "CurrencyInputModal"

const useStyles = makeStyles(() => ({
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
}))
