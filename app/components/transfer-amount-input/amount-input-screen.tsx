import * as React from "react"
import { useCallback, useEffect, useReducer, useRef } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { CurrencyInfo, useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import {
  greaterThan,
  lessThan,
  MoneyAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"

import { AmountInputScreenUI } from "./amount-input-screen-ui"
import {
  Key,
  NumberPadNumber,
  numberPadReducer,
  NumberPadReducerActionType,
  NumberPadReducerState,
} from "../amount-input-screen/number-pad-reducer"
import {
  IInputValues,
  InputField,
} from "@app/screens/conversion-flow/use-convert-money-details"

export type AmountInputScreenProps = {
  inputValues: IInputValues
  onAmountChange: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  walletCurrency?: WalletCurrency
  convertMoneyAmount: ConvertMoneyAmount
  maxAmount?: MoneyAmount<WalletOrDisplayCurrency>
  minAmount?: MoneyAmount<WalletOrDisplayCurrency>
  onSetFormattedAmount: (InputValue: IInputValues) => void
  initialAmount?: MoneyAmount<WalletOrDisplayCurrency>
  focusedInput: InputField | null
  responsive?: boolean
}

enum InputType {
  FROM = "fromInput",
  TO = "toInput",
  CURRENCY = "currencyInput",
}

const formatNumberPadNumber = (numberPadNumber: NumberPadNumber) => {
  const { majorAmount, minorAmount, hasDecimal } = numberPadNumber

  if (!majorAmount && !minorAmount && !hasDecimal) {
    return ""
  }

  const formattedMajorAmount = Number(majorAmount).toLocaleString()

  if (hasDecimal) {
    return `${formattedMajorAmount}.${minorAmount}`
  }

  return formattedMajorAmount
}

const numberPadNumberToMoneyAmount = ({
  numberPadNumber,
  currency,
  currencyInfo,
}: {
  numberPadNumber: NumberPadNumber
  currency: WalletOrDisplayCurrency
  currencyInfo: Record<WalletOrDisplayCurrency, CurrencyInfo>
}): MoneyAmount<WalletOrDisplayCurrency> => {
  const { majorAmount, minorAmount } = numberPadNumber
  const { minorUnitToMajorUnitOffset, currencyCode } = currencyInfo[currency]

  const majorAmountInMinorUnit =
    Math.pow(10, minorUnitToMajorUnitOffset) * Number(majorAmount)

  // if minorUnitToMajorUnitOffset is 2, slice 234354 to 23
  const slicedMinorAmount = minorAmount.slice(0, minorUnitToMajorUnitOffset)
  // if minorAmount is 4 and minorUnitToMajorUnitOffset is 2, then missing zeros is 1
  const minorAmountMissingZeros = minorUnitToMajorUnitOffset - slicedMinorAmount.length

  const amount =
    majorAmountInMinorUnit + Number(minorAmount) * Math.pow(10, minorAmountMissingZeros)

  return {
    amount,
    currency,
    currencyCode,
  }
}

const moneyAmountToNumberPadReducerState = ({
  moneyAmount,
  currencyInfo,
}: {
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
  currencyInfo: ReturnType<typeof useDisplayCurrency>["currencyInfo"]
}): NumberPadReducerState => {
  const amountString = moneyAmount.amount.toString()
  const { minorUnitToMajorUnitOffset, showFractionDigits } =
    currencyInfo[moneyAmount.currency]

  let numberPadNumber: NumberPadNumber

  if (amountString === "0") {
    numberPadNumber = {
      majorAmount: "",
      minorAmount: "",
      hasDecimal: false,
    }
  } else if (amountString.length <= minorUnitToMajorUnitOffset) {
    numberPadNumber = {
      majorAmount: "0",
      minorAmount: showFractionDigits
        ? amountString.padStart(minorUnitToMajorUnitOffset, "0")
        : "",
      hasDecimal: showFractionDigits,
    }
  } else {
    numberPadNumber = {
      majorAmount: amountString.slice(
        0,
        amountString.length - minorUnitToMajorUnitOffset,
      ),
      minorAmount: showFractionDigits
        ? amountString.slice(amountString.length - minorUnitToMajorUnitOffset)
        : "",
      hasDecimal: showFractionDigits && minorUnitToMajorUnitOffset > 0,
    }
  }

  return {
    numberPadNumber,
    numberOfDecimalsAllowed: showFractionDigits ? minorUnitToMajorUnitOffset : 0,
    currency: moneyAmount.currency,
  }
}

/**
 *
 * TODO: Check if this component is the most appropriate place to implement the conversion functionality.
 *
 */
export const AmountInputScreen: React.FC<AmountInputScreenProps> = ({
  inputValues,
  onAmountChange,
  convertMoneyAmount,
  maxAmount,
  minAmount,
  onSetFormattedAmount,
  initialAmount,
  focusedInput,
  responsive = false
}) => {
  const { currencyInfo, formatMoneyAmount, zeroDisplayAmount } = useDisplayCurrency()
  const { LL } = useI18nContext()

  const lastValuesRef = useRef<IInputValues | null>(null)
  const skipNextRecalcRef = useRef(false)
  const focusedIdRef = useRef<InputField["id"] | null>(null)

  const [numberPadState, dispatchNumberPadAction] = useReducer(
    numberPadReducer,
    moneyAmountToNumberPadReducerState({
      moneyAmount: zeroDisplayAmount,
      currencyInfo,
    }),
  )

  const handleKeyPress = useCallback((key: Key) => {
    dispatchNumberPadAction({
      action: NumberPadReducerActionType.HandleKeyPress,
      payload: { key },
    })
  }, [])

  const handlePaste = useCallback((keys: number) => {
    dispatchNumberPadAction({
      action: NumberPadReducerActionType.HandlePaste,
      payload: { keys },
    })
  }, [])

  const handleClear = useCallback(() => {
    dispatchNumberPadAction({
      action: NumberPadReducerActionType.ClearAmount,
    })
  }, [])

  const setNumberPadAmount = useCallback(
    (amount: MoneyAmount<WalletOrDisplayCurrency>) => {
      dispatchNumberPadAction({
        action: NumberPadReducerActionType.SetAmount,
        payload: moneyAmountToNumberPadReducerState({
          moneyAmount: amount,
          currencyInfo,
        }),
      })
    },
    [currencyInfo],
  )

  const createFocusStates = useCallback(
    (focusedId: InputField["id"] | null) => ({
      fromInput: { isFocused: focusedId === InputType.FROM },
      toInput: { isFocused: focusedId === InputType.TO },
      currencyInput: { isFocused: focusedId === InputType.CURRENCY },
    }),
    [],
  )

  const convertToInputCurrencies = useCallback(
    (
      primaryAmount: MoneyAmount<WalletOrDisplayCurrency>,
      primaryCurrency: WalletOrDisplayCurrency,
    ) => {
      const convertAmount = (targetCurrency: WalletOrDisplayCurrency) =>
        targetCurrency === primaryCurrency
          ? primaryAmount
          : convertMoneyAmount(primaryAmount, targetCurrency)

      return {
        fromAmount: convertAmount(inputValues.fromInput.amount.currency),
        toAmount: convertAmount(inputValues.toInput.amount.currency),
        currencyAmount: convertAmount(inputValues.currencyInput.amount.currency),
      }
    },
    [convertMoneyAmount, inputValues],
  )

  useEffect(() => {
    if (initialAmount) {
      setNumberPadAmount(initialAmount)
    }
  }, [initialAmount, setNumberPadAmount])

  useEffect(() => {
    if (!focusedInput) return

    skipNextRecalcRef.current = true
    focusedIdRef.current = focusedInput.id

    setNumberPadAmount(focusedInput.amount)

    const npState = moneyAmountToNumberPadReducerState({
      moneyAmount: focusedInput.amount,
      currencyInfo,
    })
    const formattedOnFocus = formatNumberPadNumber(npState.numberPadNumber)
    const focusStates = createFocusStates(focusedIdRef.current)
    const baseValues = lastValuesRef.current || inputValues

    const updatedValues = {
      ...baseValues,
      formattedAmount: formattedOnFocus,
      fromInput: { ...baseValues.fromInput, ...focusStates.fromInput },
      toInput: { ...baseValues.toInput, ...focusStates.toInput },
      currencyInput: { ...baseValues.currencyInput, ...focusStates.currencyInput },
    }

    onSetFormattedAmount(updatedValues)
  }, [
    focusedInput,
    setNumberPadAmount,
    onSetFormattedAmount,
    currencyInfo,
    inputValues,
    createFocusStates,
  ])

  useEffect(() => {
    if (!inputValues || skipNextRecalcRef.current) {
      if (skipNextRecalcRef.current) {
        skipNextRecalcRef.current = false
      }
      return
    }

    const { numberPadNumber, currency: primaryCurrency } = numberPadState
    const formattedAmount = formatNumberPadNumber(numberPadNumber)

    const primaryAmount = numberPadNumberToMoneyAmount({
      numberPadNumber,
      currency: primaryCurrency,
      currencyInfo,
    })

    const { fromAmount, toAmount, currencyAmount } = convertToInputCurrencies(
      primaryAmount,
      primaryCurrency,
    )

    const formatAmount = (
      amount: MoneyAmount<WalletOrDisplayCurrency>,
      isApproximate = false,
    ) =>
      formattedAmount ? formatMoneyAmount({ moneyAmount: amount, isApproximate }) : ""

    const payload: IInputValues = {
      formattedAmount,
      fromInput: {
        id: InputType.FROM,
        currency: inputValues.fromInput.amount.currency,
        formattedAmount: formatAmount(fromAmount),
        isFocused: focusedIdRef.current === InputType.FROM,
        amount: fromAmount,
      },
      toInput: {
        id: InputType.TO,
        currency: inputValues.toInput.amount.currency,
        formattedAmount: formatAmount(toAmount, true),
        isFocused: focusedIdRef.current === InputType.TO,
        amount: toAmount,
      },
      currencyInput: {
        id: InputType.CURRENCY,
        currency: inputValues.currencyInput.amount.currency,
        formattedAmount: formatAmount(currencyAmount),
        isFocused: focusedIdRef.current === InputType.CURRENCY,
        amount: currencyAmount,
      },
    }

    onSetFormattedAmount(payload)
    lastValuesRef.current = payload
    onAmountChange(primaryAmount)
  }, [
    numberPadState,
    currencyInfo,
    inputValues,
    formatMoneyAmount,
    onSetFormattedAmount,
    onAmountChange,
    convertToInputCurrencies,
  ])

  const getErrorMessage = () => {
    const currentAmount = numberPadNumberToMoneyAmount({
      numberPadNumber: numberPadState.numberPadNumber,
      currency: numberPadState.currency,
      currencyInfo,
    })

    if (maxAmount) {
      const maxInPrimaryCurrency = convertMoneyAmount(maxAmount, currentAmount.currency)
      const currentInMaxCurrency = convertMoneyAmount(
        currentAmount,
        maxInPrimaryCurrency.currency,
      )

      if (
        greaterThan({ value: currentInMaxCurrency, greaterThan: maxInPrimaryCurrency })
      ) {
        return LL.AmountInputScreen.maxAmountExceeded({
          maxAmount: formatMoneyAmount({ moneyAmount: maxInPrimaryCurrency }),
        })
      }
    }

    if (minAmount && currentAmount.amount) {
      const minInPrimaryCurrency = convertMoneyAmount(minAmount, currentAmount.currency)
      const currentInMinCurrency = convertMoneyAmount(
        currentAmount,
        minInPrimaryCurrency.currency,
      )

      if (lessThan({ value: currentInMinCurrency, lessThan: minInPrimaryCurrency })) {
        return LL.AmountInputScreen.minAmountNotMet({
          minAmount: formatMoneyAmount({ moneyAmount: minInPrimaryCurrency }),
        })
      }
    }

    return null
  }

  const errorMessage = getErrorMessage()

  return (
    <AmountInputScreenUI
      onPaste={handlePaste}
      onClearAmount={handleClear}
      errorMessage={errorMessage || ""}
      onKeyPress={handleKeyPress}
      responsive={responsive}
    />
  )
}
