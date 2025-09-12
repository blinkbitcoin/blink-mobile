import { useCallback } from "react"

import { DisplayCurrency } from "@app/types/amounts"
import { WalletCurrency } from "@app/graphql/generated"

import { IInputValues, InputField } from "../use-convert-money-details"

type GetCurrencySymbol = (p: { currency: WalletCurrency | DisplayCurrency }) => string

type Params = {
  inputValues: IInputValues
  inputFormattedValues: IInputValues | null
  isTyping: boolean
  typingInputId: InputField["id"] | null
  lockFormattingInputId: InputField["id"] | null
  displayCurrency: DisplayCurrency
  getCurrencySymbol: GetCurrencySymbol
}

const findSatIndex = (value: string): number => {
  const idx = value.toUpperCase().indexOf(" SAT")
  return idx >= 0 ? idx : value.length
}

export const useConversionFormatting = ({
  inputValues,
  inputFormattedValues,
  isTyping,
  typingInputId,
  lockFormattingInputId,
  displayCurrency,
  getCurrencySymbol,
}: Params) => {
  const fieldFormatted = useCallback(
    (id: InputField["id"]) =>
      id === "fromInput"
        ? inputFormattedValues?.fromInput.formattedAmount || ""
        : id === "toInput"
          ? inputFormattedValues?.toInput.formattedAmount || ""
          : inputFormattedValues?.currencyInput.formattedAmount || "",
    [inputFormattedValues],
  )

  const typedValue = useCallback(
    (id: InputField["id"]) => {
      const digits = inputFormattedValues?.formattedAmount ?? ""
      if (!digits) return ""
      const curr =
        id === "fromInput"
          ? inputValues.fromInput.currency
          : id === "toInput"
            ? inputValues.toInput.currency
            : displayCurrency
      if (curr === WalletCurrency.Btc) return `${digits} SAT`

      return `${getCurrencySymbol({ currency: curr })}${digits}`
    },
    [inputFormattedValues, inputValues, displayCurrency, getCurrencySymbol],
  )

  const renderValue = useCallback(
    (id: InputField["id"]) =>
      (isTyping && typingInputId === id) || lockFormattingInputId === id
        ? typedValue(id)
        : fieldFormatted(id),
    [isTyping, typingInputId, lockFormattingInputId, typedValue, fieldFormatted],
  )

  const caretSelectionFor = useCallback(
    (id: InputField["id"]) => {
      const value = renderValue(id) ?? ""
      const pos = findSatIndex(value)
      return { start: pos, end: pos } as const
    },
    [renderValue],
  )

  return { renderValue, caretSelectionFor }
}
