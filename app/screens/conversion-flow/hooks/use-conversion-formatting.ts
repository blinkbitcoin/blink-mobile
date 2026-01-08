import { useCallback } from "react"

import { ConvertInputType } from "@app/components/transfer-amount-input"
import { WalletCurrency } from "@app/graphql/generated"
import { DisplayCurrency } from "@app/types/amounts"
import {
  findBtcSuffixIndex,
  formatBtcWithSuffix,
} from "@app/screens/conversion-flow/btc-format"
import {
  InputField,
  InputValues,
} from "@app/screens/conversion-flow/use-convert-money-details"

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
  const getInputField = useCallback(
    (id: InputField["id"]) => {
      if (id === ConvertInputType.FROM) return inputFormattedValues?.fromInput
      if (id === ConvertInputType.TO) return inputFormattedValues?.toInput
      return inputFormattedValues?.currencyInput
    },
    [inputFormattedValues],
  )

  const fieldFormatted = useCallback(
    (id: InputField["id"]) => getInputField(id)?.formattedAmount || "",
    [getInputField],
  )

  const getCurrency = useCallback(
    (id: InputField["id"]) => {
      if (id === ConvertInputType.FROM) return inputValues.fromInput.currency
      if (id === ConvertInputType.TO) return inputValues.toInput.currency
      return displayCurrency
    },
    [inputValues, displayCurrency],
  )

  const typedValue = useCallback(
    (id: InputField["id"]) => {
      const digits = inputFormattedValues?.formattedAmount ?? ""
      if (!digits) return ""

      const currency = getCurrency(id)
      if (currency === WalletCurrency.Btc) return formatBtcWithSuffix(digits)
      return `${getCurrencySymbol({ currency })}${digits}`
    },
    [inputFormattedValues, getCurrency, getCurrencySymbol],
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
