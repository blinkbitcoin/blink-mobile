import * as React from "react"
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"

import { APPROXIMATE_PREFIX } from "@app/config"
import { WalletCurrency } from "@app/graphql/generated"
import { useDebouncedEffect } from "@app/hooks/use-debounce"
import { CurrencyInfo, useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import {
  InputField,
  InputValues,
} from "@app/screens/conversion-flow/use-convert-money-details"
import {
  formatNumberPadNumber,
  getDisabledKeys,
  Key,
  NumberPadNumber,
  numberPadReducer,
  NumberPadReducerActionType,
  NumberPadReducerState,
  formatNumberPadNumber,
} from "@app/components/amount-input-screen/number-pad-reducer"
import {
  greaterThan,
  lessThan,
  MoneyAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"

import { AmountInputScreenUI } from "./amount-input-screen-ui"

export type AmountInputScreenProps = {
  inputValues: InputValues
  onAmountChange: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  walletCurrency?: WalletCurrency
  convertMoneyAmount: ConvertMoneyAmount
  maxAmount?: MoneyAmount<WalletOrDisplayCurrency>
  minAmount?: MoneyAmount<WalletOrDisplayCurrency>
  onSetFormattedAmount: (InputValue: InputValues) => void
  initialAmount?: MoneyAmount<WalletOrDisplayCurrency>
  focusedInput: InputField | null
  debounceMs?: number
  onTypingChange?: (typing: boolean, focusedId: InputField["id"] | null) => void
  onAfterRecalc?: () => void
  lockFormattingUntilBlur?: boolean
}

export enum ConvertInputType {
  FROM = "fromInput",
  TO = "toInput",
  CURRENCY = "currencyInput",
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
  const majorInMinor = Math.pow(10, minorUnitToMajorUnitOffset) * Number(majorAmount)
  const slicedMinor = minorAmount.slice(0, minorUnitToMajorUnitOffset)
  const missing = minorUnitToMajorUnitOffset - slicedMinor.length
  const amount = majorInMinor + Number(minorAmount) * Math.pow(10, missing)
  return { amount, currency, currencyCode }
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
    numberPadNumber = { majorAmount: "", minorAmount: "", hasDecimal: false }
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

const snapshotKey = (values: InputValues) => {
  const focusedValue = (isFocused: boolean) => (isFocused ? 1 : 0)

  return [
    values.formattedAmount,
    values.fromInput.formattedAmount,
    values.toInput.formattedAmount,
    values.currencyInput.formattedAmount,
    values.fromInput.currency,
    values.toInput.currency,
    values.currencyInput.currency,
    focusedValue(values.fromInput.isFocused),
    focusedValue(values.toInput.isFocused),
    focusedValue(values.currencyInput.isFocused),
  ].join("|")
}

export const AmountInputScreen: React.FC<AmountInputScreenProps> = ({
  inputValues,
  onAmountChange,
  convertMoneyAmount,
  maxAmount,
  minAmount,
  onSetFormattedAmount,
  initialAmount,
  focusedInput,
  debounceMs = 600,
  onTypingChange,
  onAfterRecalc,
  lockFormattingUntilBlur = false,
}) => {
  const { currencyInfo, formatMoneyAmount, zeroDisplayAmount } = useDisplayCurrency()
  const { LL } = useI18nContext()

  const lastValuesRef = useRef<InputValues | null>(null)
  const lastSnapshotRef = useRef<string | null>(null)
  const skipNextRecalcRef = useRef(false)
  const focusedIdRef = useRef<InputField["id"] | null>(null)
  const prevFocusSigRef = useRef<string | null>(null)

  const [numberPadState, dispatchNumberPadAction] = useReducer(
    numberPadReducer,
    moneyAmountToNumberPadReducerState({
      moneyAmount: zeroDisplayAmount,
      currencyInfo,
    }),
  )

  const freezeFormatRef = useRef(false)
  const typingRef = useRef(false)
  const [typingState, setTypingState] = useState(false)
  const forceDebounceRef = useRef(false)

  const notifyTyping = useCallback(
    (typing: boolean) => {
      typingRef.current = typing
      setTypingState(typing)
      if (onTypingChange) onTypingChange(typing, focusedIdRef.current)
    },
    [onTypingChange],
  )

  const startTyping = useCallback(() => {
    if (!typingRef.current) notifyTyping(true)
    if (lockFormattingUntilBlur) freezeFormatRef.current = true
  }, [notifyTyping, lockFormattingUntilBlur])

  const handleKeyPress = useCallback(
    (key: Key) => {
      startTyping()
      dispatchNumberPadAction({
        action: NumberPadReducerActionType.HandleKeyPress,
        payload: { key },
      })
    },
    [startTyping],
  )

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
      fromInput: { isFocused: focusedId === ConvertInputType.FROM },
      toInput: { isFocused: focusedId === ConvertInputType.TO },
      currencyInput: { isFocused: focusedId === ConvertInputType.CURRENCY },
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
      forceDebounceRef.current = true
    }
  }, [initialAmount, setNumberPadAmount])

  useEffect(() => {
    if (!focusedInput) return

    const focusSig = `${focusedInput.id}|${focusedInput.amount.amount}|${focusedInput.amount.currency}`
    if (prevFocusSigRef.current === focusSig) {
      return
    }

    prevFocusSigRef.current = focusSig
    skipNextRecalcRef.current = true
    focusedIdRef.current = focusedInput.id
    freezeFormatRef.current = false

    const currentAmountFromNp = numberPadNumberToMoneyAmount({
      numberPadNumber: moneyAmountToNumberPadReducerState({
        moneyAmount: zeroDisplayAmount,
        currencyInfo,
      }).numberPadNumber,
      currency: focusedInput.amount.currency,
      currencyInfo,
    })

    forceDebounceRef.current =
      currentAmountFromNp.amount !== focusedInput.amount.amount ||
      currentAmountFromNp.currency !== focusedInput.amount.currency

    setNumberPadAmount(focusedInput.amount)

    const npState = moneyAmountToNumberPadReducerState({
      moneyAmount: focusedInput.amount,
      currencyInfo,
    })
    const formattedOnFocus = formatNumberPadNumber({
      ...npState,
      currencyInfo,
      noSuffix: true,
    })
    const focusStates = createFocusStates(focusedIdRef.current)
    const baseValues = lastValuesRef.current || inputValues

    const stripApproximatePrefix = (value?: string) => {
      if (!value) return value
      return value.replace(new RegExp(`^\\s*${APPROXIMATE_PREFIX}\\s*`), "")
    }

    const ensureApproximatePrefix = (value?: string) => {
      if (!value) return value
      if (value.trim().startsWith(APPROXIMATE_PREFIX)) return value
      return `${APPROXIMATE_PREFIX} ${value}`
    }

    const updatedValues: InputValues = {
      ...baseValues,
      formattedAmount: formattedOnFocus,
      fromInput: {
        ...baseValues.fromInput,
        ...focusStates.fromInput,
        formattedAmount:
          focusedIdRef.current === ConvertInputType.FROM
            ? stripApproximatePrefix(baseValues.fromInput.formattedAmount) ?? ""
            : ensureApproximatePrefix(baseValues.fromInput.formattedAmount) ?? "",
      },
      toInput: {
        ...baseValues.toInput,
        ...focusStates.toInput,
        formattedAmount:
          focusedIdRef.current === ConvertInputType.TO
            ? stripApproximatePrefix(baseValues.toInput.formattedAmount) ?? ""
            : ensureApproximatePrefix(baseValues.toInput.formattedAmount) ?? "",
      },
      currencyInput: {
        ...baseValues.currencyInput,
        ...focusStates.currencyInput,
        formattedAmount:
          focusedIdRef.current === ConvertInputType.CURRENCY
            ? stripApproximatePrefix(baseValues.currencyInput.formattedAmount) ?? ""
            : ensureApproximatePrefix(baseValues.currencyInput.formattedAmount) ?? "",
      },
    }

    const nextSnap = snapshotKey(updatedValues)
    if (nextSnap !== lastSnapshotRef.current) {
      onSetFormattedAmount(updatedValues)
      lastSnapshotRef.current = nextSnap
      lastValuesRef.current = updatedValues
    }
  }, [
    focusedInput,
    setNumberPadAmount,
    onSetFormattedAmount,
    currencyInfo,
    inputValues,
    createFocusStates,
    zeroDisplayAmount,
  ])

  useEffect(() => {
    if (!typingRef.current) return
    const formattedAmount = formatNumberPadNumber({
      ...numberPadState,
      currencyInfo,
      noSuffix: true,
    })
    const baseValues = lastValuesRef.current || inputValues

    const payload: InputValues = {
      ...baseValues,
      formattedAmount,
    }

    const nextSnap = snapshotKey(payload)
    if (nextSnap !== lastSnapshotRef.current) {
      onSetFormattedAmount(payload)
      lastSnapshotRef.current = nextSnap
      lastValuesRef.current = payload
    }
  }, [numberPadState, currencyInfo, inputValues, onSetFormattedAmount])

  useEffect(() => {
    if (skipNextRecalcRef.current) {
      skipNextRecalcRef.current = false
    }
  }, [focusedInput])

  const debounceEnabled =
    Boolean(inputValues) &&
    !skipNextRecalcRef.current &&
    (typingState || forceDebounceRef.current)

  useDebouncedEffect(
    () => {
      const { numberPadNumber } = numberPadState

      const digitsEmpty =
        !numberPadNumber.majorAmount &&
        !numberPadNumber.minorAmount &&
        !numberPadNumber.hasDecimal

      if (digitsEmpty && !lastValuesRef.current) return

      const pickWhenEmpty =
        inputValues.fromInput.amount.amount > 0
          ? inputValues.fromInput.amount
          : inputValues.toInput.amount.amount > 0
            ? inputValues.toInput.amount
            : inputValues.currencyInput.amount

      const primaryCurrency: WalletOrDisplayCurrency = digitsEmpty
        ? pickWhenEmpty.currency
        : numberPadState.currency

      const primaryAmount: MoneyAmount<WalletOrDisplayCurrency> = digitsEmpty
        ? pickWhenEmpty
        : numberPadNumberToMoneyAmount({
            numberPadNumber,
            currency: primaryCurrency,
            currencyInfo,
          })

      const primaryNpState = moneyAmountToNumberPadReducerState({
        moneyAmount: primaryAmount,
        currencyInfo,
      })

      const formattedFromPrimary = formatNumberPadNumber({
        ...primaryNpState,
        currencyInfo,
        noSuffix: true,
      })

      const { fromAmount, toAmount, currencyAmount } = convertToInputCurrencies(
        primaryAmount,
        primaryCurrency,
      )

      const formatAmount = (
        amount: MoneyAmount<WalletOrDisplayCurrency>,
        isApproximate = false,
      ) => formatMoneyAmount({ moneyAmount: amount, isApproximate })

      const formattedForParent = freezeFormatRef.current
        ? lastValuesRef.current?.formattedAmount ??
          formatNumberPadNumber({ ...numberPadState, currencyInfo, noSuffix: true })
        : formattedFromPrimary

      const getFormattedAmount = (
        amount: MoneyAmount<WalletOrDisplayCurrency>,
        isApproximate = false,
      ) => {
        if (digitsEmpty || primaryAmount.amount === 0) return ""

        return formatAmount(amount, isApproximate)
      }

      const approxFrom = inputValues.fromInput.amount.currency !== primaryCurrency
      const approxTo = inputValues.toInput.amount.currency !== primaryCurrency
      const approxCurrency = inputValues.currencyInput.amount.currency !== primaryCurrency

      const payload: InputValues = {
        formattedAmount: digitsEmpty ? "" : formattedForParent,
        fromInput: {
          id: ConvertInputType.FROM,
          currency: inputValues.fromInput.amount.currency,
          formattedAmount: getFormattedAmount(fromAmount, approxFrom),
          isFocused: focusedIdRef.current === ConvertInputType.FROM,
          amount: fromAmount,
        },
        toInput: {
          id: ConvertInputType.TO,
          currency: inputValues.toInput.amount.currency,
          formattedAmount: getFormattedAmount(toAmount, approxTo),
          isFocused: focusedIdRef.current === ConvertInputType.TO,
          amount: toAmount,
        },
        currencyInput: {
          id: ConvertInputType.CURRENCY,
          currency: inputValues.currencyInput.amount.currency,
          formattedAmount: getFormattedAmount(currencyAmount, approxCurrency),
          isFocused: focusedIdRef.current === ConvertInputType.CURRENCY,
          amount: currencyAmount,
        },
      }

      const nextSnap = snapshotKey(payload)
      if (nextSnap !== lastSnapshotRef.current) {
        onSetFormattedAmount(payload)
        lastSnapshotRef.current = nextSnap
        lastValuesRef.current = payload
      }

      onAmountChange(primaryAmount)
      notifyTyping(false)
      forceDebounceRef.current = false
      onAfterRecalc?.()
    },
    debounceMs,
    [
      numberPadState,
      currencyInfo,
      inputValues,
      formatMoneyAmount,
      onSetFormattedAmount,
      onAmountChange,
      convertToInputCurrencies,
      notifyTyping,
      onAfterRecalc,
    ],
    { enabled: debounceEnabled, leading: false, trailing: true },
  )

  const getErrorMessage = () => {
    if (typingRef.current) return null

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
  const disabledKeys = useMemo(() => getDisabledKeys(numberPadState), [numberPadState])

  return (
    <AmountInputScreenUI
      errorMessage={errorMessage || ""}
      onKeyPress={handleKeyPress}
      disabledKeys={disabledKeys}
    />
  )
}
