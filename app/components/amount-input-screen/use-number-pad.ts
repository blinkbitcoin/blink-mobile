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
  /** The caller's amount, re-read whenever what the typed digits mean changes. */
  amountOfRecord?: MoneyAmount<WalletOrDisplayCurrency>
  onAmountChange: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
}

/**
 * The state behind an in-screen number pad: what the user has typed, which currency they
 * are typing in, and which keys are live. It holds only the typed value — the screen's own
 * amount stays the amount of record, so a wallet switch can hand it an exact amount
 * while the pad shows that amount rounded to the currency being typed in.
 *
 * The canonical pad: every screen with a keypad should drive `CurrencyKeyboard` from this
 * hook, so a key behaves the same wherever it is pressed.
 */
export const useNumberPad = ({
  walletCurrency,
  convertMoneyAmount,
  amountOfRecord,
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

  /** What the typed digits mean, as set from outside the pad: the sending wallet, and the
   *  display currency a rate arriving or being lost swaps. When the one the pad types in
   *  moves, the pad re-reads the amount of record rather than reading its digits in the
   *  new unit. It waits until the caller's amount and conversion have caught up, which the
   *  converted amount's currency code shows. A wallet currency typed in follows the
   *  sending wallet; display digits stay as typed across a wallet switch. */
  const display = currencyInfo[DisplayCurrency]
  const displayMeaning = `${display.currencyCode}:${display.minorUnitToMajorUnitOffset}:${display.showFractionDigits}`
  const [read, setRead] = useState({ displayMeaning, walletCurrency })
  const isTypingDisplay = padState.currency === DisplayCurrency
  const hasMeaningMoved = isTypingDisplay
    ? displayMeaning !== read.displayMeaning
    : walletCurrency !== read.walletCurrency
  if (
    (displayMeaning !== read.displayMeaning || walletCurrency !== read.walletCurrency) &&
    !hasMeaningMoved
  ) {
    setRead({ displayMeaning, walletCurrency })
  } else if (hasMeaningMoved && convertMoneyAmount) {
    const currency = isTypingDisplay ? DisplayCurrency : walletCurrency
    const { currencyCode } = currencyInfo[currency]
    const reread = amountOfRecord
      ? convertMoneyAmount(amountOfRecord, currency)
      : { amount: 0, currency, currencyCode }
    if (reread.currencyCode === currencyCode && Number.isFinite(reread.amount)) {
      setRead({ displayMeaning, walletCurrency })
      setPadState(
        moneyAmountToNumberPadReducerState({ moneyAmount: reread, currencyInfo }),
      )
    }
  }

  const toMoneyAmount = useCallback(
    (state: NumberPadReducerState) =>
      numberPadNumberToMoneyAmount({
        numberPadNumber: state.numberPadNumber,
        currency: state.currency,
        currencyInfo,
      }),
    [currencyInfo],
  )

  /** Returns whether the key was accepted, so the keypad can skip a refused key's haptic. */
  const onKeyPress = useCallback(
    (key: Key) => {
      const next = numberPadReducer(padState, {
        action: NumberPadReducerActionType.HandleKeyPress,
        payload: { key },
      })
      if (next === padState) return false
      setPadState(next)
      onAmountChange(toMoneyAmount(next))
      return true
    },
    [padState, onAmountChange, toMoneyAmount],
  )

  /** Mirrors an amount set from outside the pad (a wallet switch) without
   *  reporting it back, so the caller's exact amount is never replaced by the rounded one.
   *  A change of currency is saved as the preference, whoever makes it, because review
   *  leads with the preferred currency and must read the amount the way the pad showed it. */
  const showAmount = useCallback(
    (amount: MoneyAmount<WalletOrDisplayCurrency>, currency = padState.currency) => {
      if (!convertMoneyAmount) return
      if (currency !== padState.currency) {
        savePreferredAmountCurrency(
          client,
          currency === DisplayCurrency
            ? PreferredAmountCurrency.Display
            : PreferredAmountCurrency.Default,
        )
      }
      setPadState(
        moneyAmountToNumberPadReducerState({
          moneyAmount: convertMoneyAmount(amount, currency),
          currencyInfo,
        }),
      )
    },
    [client, padState.currency, convertMoneyAmount, currencyInfo],
  )

  const padAmount = toMoneyAmount(padState)

  /** Swaps the typed currency between display and wallet. Converts the caller's amount of
   *  record, not the pad's rounded mirror of it, so swapping back and forth never drifts
   *  the shown amount away from the one that will be sent. */
  const toggleCurrency = useCallback(
    (
      currency: WalletOrDisplayCurrency,
      amountOfRecord: MoneyAmount<WalletOrDisplayCurrency>,
    ) => {
      if (currency === padState.currency) return
      showAmount(amountOfRecord, currency)
    },
    [padState.currency, showAmount],
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
