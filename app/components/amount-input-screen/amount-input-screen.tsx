import * as React from "react"
import { useCallback, useEffect, useMemo, useReducer } from "react"

import { useApolloClient } from "@apollo/client"

import {
  PreferredAmountCurrency,
  savePreferredAmountCurrency,
} from "@app/graphql/client-only-query"
import {
  PreferredAmountCurrencyDocument,
  PreferredAmountCurrencyQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { CurrencyInfo, useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import {
  DisplayCurrency,
  greaterThan,
  lessThan,
  MoneyAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"

import { AmountInputScreenUI } from "./amount-input-screen-ui"
import {
  formatNumberPadNumber,
  getDisabledKeys,
  Key,
  NumberPadNumber,
  numberPadReducer,
  NumberPadReducerActionType,
  NumberPadReducerState,
} from "./number-pad-reducer"

export type AmountInputScreenProps = {
  initialAmount?: MoneyAmount<WalletOrDisplayCurrency>
  setAmount?: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  walletCurrency: WalletCurrency
  convertMoneyAmount: ConvertMoneyAmount
  maxAmount?: MoneyAmount<WalletOrDisplayCurrency>
  maxAmountIsBalance?: boolean
  minAmount?: MoneyAmount<WalletOrDisplayCurrency>
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

export const AmountInputScreen: React.FC<AmountInputScreenProps> = ({
  initialAmount,
  setAmount,
  walletCurrency,
  convertMoneyAmount,
  maxAmount,
  maxAmountIsBalance,
  minAmount,
}) => {
  const {
    currencyInfo,
    getSecondaryAmountIfCurrencyIsDifferent,
    formatMoneyAmount,
    zeroDisplayAmount,
  } = useDisplayCurrency()

  const { LL } = useI18nContext()
  const client = useApolloClient()
  const preferredCurrency = client.readQuery<PreferredAmountCurrencyQuery>({
    query: PreferredAmountCurrencyDocument,
  })?.preferredAmountCurrency

  const resolvedInitialAmount = (() => {
    if (initialAmount?.amount) return initialAmount
    if (preferredCurrency) {
      const currency =
        preferredCurrency === PreferredAmountCurrency.Display
          ? DisplayCurrency
          : walletCurrency
      return {
        amount: 0,
        currency,
        currencyCode: currencyInfo[currency].currencyCode,
      } as MoneyAmount<WalletOrDisplayCurrency>
    }
    return initialAmount || zeroDisplayAmount
  })()

  const [numberPadState, dispatchNumberPadAction] = useReducer(
    numberPadReducer,
    moneyAmountToNumberPadReducerState({
      moneyAmount: resolvedInitialAmount,
      currencyInfo,
    }),
  )

  const newPrimaryAmount = numberPadNumberToMoneyAmount({
    numberPadNumber: numberPadState.numberPadNumber,
    currency: numberPadState.currency,
    currencyInfo,
  })

  const secondaryNewAmount = getSecondaryAmountIfCurrencyIsDifferent({
    primaryAmount: newPrimaryAmount,
    walletAmount: convertMoneyAmount(newPrimaryAmount, walletCurrency),
    displayAmount: convertMoneyAmount(newPrimaryAmount, DisplayCurrency),
  })

  const onKeyPress = (key: Key) => {
    dispatchNumberPadAction({
      action: NumberPadReducerActionType.HandleKeyPress,
      payload: {
        key,
      },
    })
  }

  const onPaste = (keys: number) => {
    dispatchNumberPadAction({
      action: NumberPadReducerActionType.HandlePaste,
      payload: {
        keys,
      },
    })
  }

  const onClear = () => {
    dispatchNumberPadAction({
      action: NumberPadReducerActionType.ClearAmount,
    })
  }

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

  const onToggleCurrency =
    secondaryNewAmount &&
    (() => {
      setNumberPadAmount(secondaryNewAmount)
    })

  const onSetAmountPress =
    setAmount &&
    (() => {
      const flag =
        numberPadState.currency === DisplayCurrency
          ? PreferredAmountCurrency.Display
          : PreferredAmountCurrency.Default
      savePreferredAmountCurrency(client, flag)
      setAmount(newPrimaryAmount)
    })

  useEffect(() => {
    if (initialAmount?.amount) {
      setNumberPadAmount(initialAmount)
    }
  }, [initialAmount, setNumberPadAmount])

  let errorMessage = ""
  const maxAmountInPrimaryCurrency =
    maxAmount && convertMoneyAmount(maxAmount, newPrimaryAmount.currency)
  const minAmountInPrimaryCurrency =
    minAmount && convertMoneyAmount(minAmount, newPrimaryAmount.currency)

  if (
    maxAmountInPrimaryCurrency &&
    greaterThan({
      value: convertMoneyAmount(newPrimaryAmount, maxAmountInPrimaryCurrency.currency),
      greaterThan: maxAmountInPrimaryCurrency,
    })
  ) {
    const formatted = formatMoneyAmount({ moneyAmount: maxAmountInPrimaryCurrency })
    errorMessage = maxAmountIsBalance
      ? LL.AmountInputScreen.exceedsAvailableBalance({ maxAmount: formatted })
      : LL.AmountInputScreen.maxAmountExceeded({ maxAmount: formatted })
  } else if (
    minAmountInPrimaryCurrency &&
    newPrimaryAmount.amount &&
    lessThan({
      value: convertMoneyAmount(newPrimaryAmount, minAmountInPrimaryCurrency.currency),
      lessThan: minAmountInPrimaryCurrency,
    })
  ) {
    errorMessage = LL.AmountInputScreen.minAmountNotMet({
      minAmount: formatMoneyAmount({ moneyAmount: minAmountInPrimaryCurrency }),
    })
  }

  const disabledKeys = useMemo(() => getDisabledKeys(numberPadState), [numberPadState])

  const primaryCurrencyInfo = currencyInfo[newPrimaryAmount.currency]
  const secondaryCurrencyInfo =
    secondaryNewAmount && currencyInfo[secondaryNewAmount.currency]

  const pillLabel = (currency: WalletOrDisplayCurrency) =>
    currency === DisplayCurrency ? currencyInfo[currency].currencyCode : currency

  return (
    <AmountInputScreenUI
      primaryCurrencyCode={pillLabel(newPrimaryAmount.currency)}
      primaryCurrencyFormattedAmount={formatNumberPadNumber({
        ...numberPadState,
        currencyInfo,
      })}
      primaryCurrencySymbol={primaryCurrencyInfo.symbol}
      secondaryCurrencyCode={
        secondaryNewAmount ? pillLabel(secondaryNewAmount.currency) : undefined
      }
      secondaryCurrencyFormattedAmount={
        secondaryNewAmount &&
        formatMoneyAmount({
          moneyAmount: secondaryNewAmount,
          noSymbol: true,
        })
      }
      secondaryCurrencySymbol={secondaryCurrencyInfo?.symbol}
      errorMessage={errorMessage}
      onKeyPress={onKeyPress}
      onPaste={onPaste}
      onClearAmount={onClear}
      onToggleCurrency={onToggleCurrency}
      setAmountDisabled={Boolean(errorMessage)}
      onSetAmountPress={onSetAmountPress}
      disabledKeys={disabledKeys}
    />
  )
}
