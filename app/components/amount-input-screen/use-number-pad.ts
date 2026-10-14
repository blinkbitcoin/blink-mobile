import { useCallback, useMemo, useState } from "react"
import { useApolloClient } from "@apollo/client"

import {
  PreferredAmountCurrency,
  savePreferredAmountCurrency,
} from "@app/graphql/client-only-query"
import { usePreferredAmountCurrencyQuery, WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import { DisplayCurrency, MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import {
  moneyAmountToNumberPadReducerState,
  numberPadNumberToMoneyAmount,
} from "./number-pad-amount"
import {
  formatNumberPadNumber,
  getDisabledKeys,
  Key,
  NumberPadReducerState,
  numberPadReducer,
  NumberPadReducerActionType,
} from "./number-pad-reducer"

type UseNumberPadArgs = {
  walletCurrency: WalletCurrency
  /** Undefined until prices load; the pad still takes keys, it just can't mirror amounts. */
  convertMoneyAmount?: ConvertMoneyAmount
  onAmountChange: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
}

/**
 * The state behind an in-screen number pad: what the user has typed, which currency they
 * are typing in, and which keys are live. It holds only the typed value — the screen's own
 * amount stays the amount of record, so a percent chip can hand it an exact wallet amount
 * while the pad shows that amount rounded to the currency being typed in.
 *
 * The canonical pad: every screen with a keypad should drive `CurrencyKeyboard` from this
 * hook, so a key behaves the same wherever it is pressed.
 */
export const useNumberPad = ({
  walletCurrency,
  convertMoneyAmount,
  onAmountChange,
}: UseNumberPadArgs) => {
  const client = useApolloClient()
  const { currencyInfo } = useDisplayCurrency()
  const { data: preferredData } = usePreferredAmountCurrencyQuery()

  const [padState, setPadState] = useState<NumberPadReducerState>(() => {
    /** Typed in the currency the user last chose, wherever they last chose it. */
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
