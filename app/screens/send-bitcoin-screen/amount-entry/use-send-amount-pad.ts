import { useCallback, useMemo, useState } from "react"
import { useApolloClient } from "@apollo/client"

import {
  moneyAmountToNumberPadReducerState,
  numberPadNumberToMoneyAmount,
} from "@app/components/amount-input-screen/number-pad-amount"
import {
  formatNumberPadNumber,
  getDisabledKeys,
  Key,
  NumberPadReducerState,
  numberPadReducer,
  NumberPadReducerActionType,
} from "@app/components/amount-input-screen/number-pad-reducer"
import {
  PreferredAmountCurrency,
  savePreferredAmountCurrency,
} from "@app/graphql/client-only-query"
import { usePreferredAmountCurrencyQuery, WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { DisplayCurrency, MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import { ConvertMoneyAmount } from "../payment-details"

type UseSendAmountPadArgs = {
  walletCurrency: WalletCurrency
  /** Undefined until prices load; the pad still takes keys, it just can't mirror amounts. */
  convertMoneyAmount?: ConvertMoneyAmount
  onAmountChange: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
}

/**
 * The in-screen keypad of the send amount step. It holds only what the user typed; the
 * payment detail stays the amount of record, so a percent chip can hand it an exact wallet
 * amount while the pad shows that amount rounded to the currency being typed in.
 */
export const useSendAmountPad = ({
  walletCurrency,
  convertMoneyAmount,
  onAmountChange,
}: UseSendAmountPadArgs) => {
  const client = useApolloClient()
  const { currencyInfo } = useDisplayCurrency()
  const { data: preferredData } = usePreferredAmountCurrencyQuery()

  const [padState, setPadState] = useState<NumberPadReducerState>(() => {
    /** Typed in the currency the user last chose on the amount modal this replaces. */
    const currency: WalletOrDisplayCurrency =
      preferredData?.preferredAmountCurrency === PreferredAmountCurrency.Default
        ? walletCurrency
        : DisplayCurrency
    return moneyAmountToNumberPadReducerState({
      moneyAmount: {
        amount: 0,
        currency,
        currencyCode: currencyInfo[currency].currencyCode,
      },
      currencyInfo,
    })
  })

  const toMoneyAmount = useCallback(
    (state: NumberPadReducerState) =>
      numberPadNumberToMoneyAmount({
        numberPadNumber: state.numberPadNumber,
        currency: state.currency,
        currencyInfo,
      }),
    [currencyInfo],
  )

  const onKeyPress = useCallback(
    (key: Key) => {
      const next = numberPadReducer(padState, {
        action: NumberPadReducerActionType.HandleKeyPress,
        payload: { key },
      })
      setPadState(next)
      onAmountChange(toMoneyAmount(next))
    },
    [padState, onAmountChange, toMoneyAmount],
  )

  /** Mirrors an amount set from outside the pad (a chip, a wallet switch) without
   *  reporting it back, so the caller's exact amount is never replaced by the rounded one. */
  const showAmount = useCallback(
    (amount: MoneyAmount<WalletOrDisplayCurrency>, currency = padState.currency) => {
      if (!convertMoneyAmount) return
      setPadState(
        moneyAmountToNumberPadReducerState({
          moneyAmount: convertMoneyAmount(amount, currency),
          currencyInfo,
        }),
      )
    },
    [padState.currency, convertMoneyAmount, currencyInfo],
  )

  const padAmount = toMoneyAmount(padState)

  /** Swaps the typed currency between display and wallet, keeping the value. */
  const toggleCurrency = useCallback(
    (currency: WalletOrDisplayCurrency) => {
      if (currency === padState.currency) return
      savePreferredAmountCurrency(
        client,
        currency === DisplayCurrency
          ? PreferredAmountCurrency.Display
          : PreferredAmountCurrency.Default,
      )
      showAmount(padAmount, currency)
    },
    [client, padState.currency, padAmount, showAmount],
  )

  const disabledKeys = useMemo(() => getDisabledKeys(padState), [padState])

  return {
    padCurrency: padState.currency,
    padAmount,
    /** The typed amount as entered ("$1." stays "$1."), so the user sees each keystroke
     *  rather than a value rounded to the currency's minor unit. */
    typedAmountText: `${currencyInfo[padState.currency].symbol}${formatNumberPadNumber({
      ...padState,
      currencyInfo,
    })}`,
    hasTyped:
      Boolean(padState.numberPadNumber.majorAmount) ||
      Boolean(padState.numberPadNumber.minorAmount) ||
      padState.numberPadNumber.hasDecimal,
    disabledKeys,
    onKeyPress,
    showAmount,
    toggleCurrency,
  }
}
