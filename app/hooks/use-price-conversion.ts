import { useMemo } from "react"

import { useRealtimePriceQuery, WalletCurrency } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import {
  createToDisplayAmount,
  DisplayCurrency,
  MoneyAmount,
  moneyAmountIsCurrencyType,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"
import crashlytics from "@react-native-firebase/crashlytics"

export const SATS_PER_BTC = 100000000

const usdDisplayCurrency = {
  symbol: "$",
  id: "USD",
  fractionDigits: 2,
}

const defaultDisplayCurrency = usdDisplayCurrency

export const usePriceConversion = () => {
  const isAuthed = useIsAuthed()
  const { data } = useRealtimePriceQuery({ skip: !isAuthed })

  const displayCurrency =
    data?.me?.defaultAccount?.realtimePrice?.denominatorCurrency ||
    defaultDisplayCurrency.id
  let displayCurrencyPerSat = NaN
  let displayCurrencyPerCent = NaN

  const realtimePrice = data?.me?.defaultAccount?.realtimePrice

  if (realtimePrice) {
    displayCurrencyPerSat =
      realtimePrice.btcSatPrice.base / 10 ** realtimePrice.btcSatPrice.offset
    displayCurrencyPerCent =
      realtimePrice.usdCentPrice.base / 10 ** realtimePrice.usdCentPrice.offset
  }

  const priceOfCurrencyInCurrency = useMemo(() => {
    if (!displayCurrencyPerSat || !displayCurrencyPerCent) {
      return undefined
    }

    // has units of denomiatedInCurrency/currency
    return (
      currency: WalletOrDisplayCurrency,
      inCurrency: WalletOrDisplayCurrency,
    ): number => {
      const priceOfCurrencyInCurrency = {
        [WalletCurrency.Btc]: {
          [DisplayCurrency]: displayCurrencyPerSat,
          [WalletCurrency.Usd]: displayCurrencyPerSat * (1 / displayCurrencyPerCent),
          [WalletCurrency.Btc]: 1,
        },
        [WalletCurrency.Usd]: {
          [DisplayCurrency]: displayCurrencyPerCent,
          [WalletCurrency.Btc]: displayCurrencyPerCent * (1 / displayCurrencyPerSat),
          [WalletCurrency.Usd]: 1,
        },
        [DisplayCurrency]: {
          [WalletCurrency.Btc]: 1 / displayCurrencyPerSat,
          [WalletCurrency.Usd]: 1 / displayCurrencyPerCent,
          [DisplayCurrency]: 1,
        },
      }
      return priceOfCurrencyInCurrency[currency][inCurrency]
    }
  }, [displayCurrencyPerSat, displayCurrencyPerCent])

  const converters = useMemo(() => {
    if (!priceOfCurrencyInCurrency) {
      return undefined
    }

    const convertWithRounding = <T extends WalletOrDisplayCurrency>(
      moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
      toCurrency: T,
      roundingFn: (value: number) => number,
    ): MoneyAmount<T> => {
      // If the money amount is already the correct currency, return it
      if (moneyAmountIsCurrencyType(moneyAmount, toCurrency)) {
        return moneyAmount
      }

      let amount = roundingFn(
        moneyAmount.amount * priceOfCurrencyInCurrency(moneyAmount.currency, toCurrency),
      )

      if (
        moneyAmountIsCurrencyType(moneyAmount, DisplayCurrency) &&
        moneyAmount.currencyCode !== displayCurrency
      ) {
        amount = NaN

        crashlytics().recordError(
          new Error(
            `Price conversion is out of sync with display currency. Money amount: ${moneyAmount.currencyCode}, display currency: ${displayCurrency}`,
          ),
        )
      }

      return {
        amount,
        currency: toCurrency,
        currencyCode: toCurrency === DisplayCurrency ? displayCurrency : toCurrency,
      }
    }

    const convertMoneyAmount = <T extends WalletOrDisplayCurrency>(
      moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
      toCurrency: T,
    ): MoneyAmount<T> => convertWithRounding(moneyAmount, toCurrency, Math.round)

    const convertMoneyAmountWithRounding = <T extends WalletOrDisplayCurrency>(
      moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
      toCurrency: T,
      roundingFn: (value: number) => number,
    ): MoneyAmount<T> => convertWithRounding(moneyAmount, toCurrency, roundingFn)

    return { convertMoneyAmount, convertMoneyAmountWithRounding }
  }, [priceOfCurrencyInCurrency, displayCurrency])

  return {
    convertMoneyAmount: converters?.convertMoneyAmount,
    convertMoneyAmountWithRounding: converters?.convertMoneyAmountWithRounding,
    displayCurrency,
    toDisplayMoneyAmount: createToDisplayAmount(displayCurrency),
    usdPerSat: priceOfCurrencyInCurrency
      ? (priceOfCurrencyInCurrency(WalletCurrency.Btc, WalletCurrency.Usd) / 100).toFixed(
          8,
        )
      : null,
  }
}
