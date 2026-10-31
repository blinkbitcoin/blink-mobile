import * as React from "react"
import { useCallback, useEffect, useMemo, useReducer } from "react"

import { useApolloClient } from "@apollo/client"

import {
  PreferredAmountCurrency,
  savePreferredAmountCurrency,
} from "@app/graphql/client-only-query"
import { usePreferredAmountCurrencyQuery, WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
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
  numberPadReducer,
  NumberPadReducerActionType,
} from "./number-pad-reducer"
import {
  moneyAmountToNumberPadReducerState,
  numberPadNumberToMoneyAmount,
} from "./number-pad-amount"

export type AmountInputScreenProps = {
  initialAmount?: MoneyAmount<WalletOrDisplayCurrency>
  setAmount?: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  walletCurrency: WalletCurrency
  convertMoneyAmount: ConvertMoneyAmount
  maxAmount?: MoneyAmount<WalletOrDisplayCurrency>
  maxAmountIsBalance?: boolean
  minAmount?: MoneyAmount<WalletOrDisplayCurrency>
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
  const { data: preferredData } = usePreferredAmountCurrencyQuery()
  const preferredCurrency = preferredData?.preferredAmountCurrency

  const resolvedInitialAmount = useMemo(() => {
    if (initialAmount && initialAmount.amount !== undefined) return initialAmount
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
  }, [initialAmount, preferredCurrency, walletCurrency, currencyInfo, zeroDisplayAmount])

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
    if (initialAmount && initialAmount.amount !== undefined) {
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
