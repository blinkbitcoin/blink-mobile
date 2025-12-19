import { useCallback } from "react"

import { DisplayCurrency } from "@app/types/amounts"
import { WalletCurrency } from "@app/graphql/generated"

import { ConvertInputType } from "@app/components/transfer-amount-input"
import { InputValues, InputField } from "../use-convert-money-details"
import { formatBtcWithSuffix, findBtcSuffixIndex } from "../btc-format"

type GetCurrencySymbol = (p: { currency: WalletCurrency | DisplayCurrency }) => string

type Params = {
  inputValues: InputValues
  inputFormattedValues: InputValues | null
  isTyping: boolean
  typingInputId: InputField["id"] | null
  lockFormattingInputId: InputField["id"] | null
  displayCurrency: DisplayCurrency
  getCurrencySymbol: GetCurrencySymbol
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
    (id: InputField["id"]) => {
      if (id === ConvertInputType.FROM) {
        return inputFormattedValues?.fromInput.formattedAmount || ""
      }
      if (id === ConvertInputType.TO) {
        return inputFormattedValues?.toInput.formattedAmount || ""
      }
      return inputFormattedValues?.currencyInput.formattedAmount || ""
    },
    [inputFormattedValues],
  )

  const typedValue = useCallback(
    (id: InputField["id"]) => {
      const digits = inputFormattedValues?.formattedAmount ?? ""
      if (!digits) return ""
      const currency =
        id === ConvertInputType.FROM
          ? inputValues.fromInput.currency
          : id === ConvertInputType.TO
            ? inputValues.toInput.currency
            : displayCurrency
      if (currency === WalletCurrency.Btc) return formatBtcWithSuffix(digits)

      return `${getCurrencySymbol({ currency })}${digits}`
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
      const pos = findBtcSuffixIndex(value)
      return { start: pos, end: pos } as const
    },
    [renderValue],
  )

  return { renderValue, caretSelectionFor }
}
