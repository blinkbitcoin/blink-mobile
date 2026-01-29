import { useCallback, useMemo } from "react"

import { gql } from "@apollo/client"
import { APPROXIMATE_PREFIX } from "@app/config"
import { useCurrencyListQuery, WalletCurrency } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import {
  DisplayAmount,
  DisplayCurrency,
  lessThan,
  MoneyAmount,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  WalletAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"

import { usePriceConversion } from "./use-price-conversion"

gql`
  query displayCurrency {
    me {
      id
      defaultAccount {
        id
        displayCurrency
      }
    }
  }

  query currencyList {
    currencyList {
      __typename
      id
      flag
      name
      symbol
      fractionDigits
    }
  }
`

export type CurrencyInfo = {
  currencyCode: string
  symbol: string
  minorUnitToMajorUnitOffset: number
  showFractionDigits: boolean
}

const usdDisplayCurrency = {
  symbol: "$",
  id: "USD",
  fractionDigits: 2,
}

const defaultDisplayCurrency = usdDisplayCurrency

const formatCurrencyHelper = ({
  amountInMajorUnits,
  symbol,
  isApproximate,
  fractionDigits,
  withSign = true,
  currencyCode,
}: {
  amountInMajorUnits: number | string
  isApproximate?: boolean
  symbol?: string
  fractionDigits: number
  currencyCode?: string
  withSign?: boolean
}) => {
  const isNegative = Number(amountInMajorUnits) < 0
  const decimalPlaces = fractionDigits
  const amountStr = Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    // FIXME this workaround of using .format and not .formatNumber is
    // because hermes haven't fully implemented Intl.NumberFormat yet
  }).format(Math.abs(Number(amountInMajorUnits)))
  return `${isApproximate ? `${APPROXIMATE_PREFIX} ` : ""}${
    isNegative && withSign ? "-" : ""
  }${symbol}${amountStr}${currencyCode ? ` ${currencyCode}` : ""}`
}

const displayCurrencyHasSignificantMinorUnits = ({
  convertMoneyAmount,
  amountInMajorUnitOrSatsToMoneyAmount,
}: {
  convertMoneyAmount?: ConvertMoneyAmount
  amountInMajorUnitOrSatsToMoneyAmount: (
    amount: number,
    currency: WalletOrDisplayCurrency,
  ) => MoneyAmount<WalletOrDisplayCurrency>
}) => {
  if (!convertMoneyAmount) {
    return true
  }

  const oneMajorUnitOfDisplayCurrency = amountInMajorUnitOrSatsToMoneyAmount(
    1,
    DisplayCurrency,
  )

  const oneUsdCentInDisplayCurrency = convertMoneyAmount(
    toUsdMoneyAmount(1),
    DisplayCurrency,
  )

  return lessThan({
    value: oneUsdCentInDisplayCurrency,
    lessThan: oneMajorUnitOfDisplayCurrency,
  })
}

export const useDisplayCurrency = () => {
  const { LL } = useI18nContext()
  const isAuthed = useIsAuthed()
  const { data: dataCurrencyList } = useCurrencyListQuery({ skip: !isAuthed })
  const { convertMoneyAmount, displayCurrency, toDisplayMoneyAmount } =
    usePriceConversion()

  const displayCurrencyDictionary = useMemo(() => {
    const currencyList = dataCurrencyList?.currencyList || []
    return currencyList.reduce(
      (acc, currency) => {
        acc[currency.id] = currency
        return acc
      },
      {} as Record<string, typeof defaultDisplayCurrency>,
    )
  }, [dataCurrencyList?.currencyList])

  const displayCurrencyInfo =
    displayCurrencyDictionary[displayCurrency] || defaultDisplayCurrency

  const moneyAmountToMajorUnitOrSats = useCallback(
    (moneyAmount: MoneyAmount<WalletOrDisplayCurrency>) => {
      switch (moneyAmount.currency) {
        case WalletCurrency.Btc:
          return moneyAmount.amount
        case WalletCurrency.Usd:
          return moneyAmount.amount / 100
        case DisplayCurrency:
          return moneyAmount.amount / 10 ** displayCurrencyInfo.fractionDigits
      }
    },
    [displayCurrencyInfo],
  )

  const amountInMajorUnitOrSatsToMoneyAmount = useCallback(
    (
      amount: number,
      currency: WalletOrDisplayCurrency,
    ): MoneyAmount<WalletOrDisplayCurrency> => {
      switch (currency) {
        case WalletCurrency.Btc:
          return toBtcMoneyAmount(Math.round(amount))
        case WalletCurrency.Usd:
          return toUsdMoneyAmount(Math.round(amount * 100))
        case DisplayCurrency:
          return toDisplayMoneyAmount(
            Math.round(amount * 10 ** displayCurrencyInfo.fractionDigits),
          )
      }
    },
    [displayCurrencyInfo, toDisplayMoneyAmount],
  )

  const displayCurrencyShouldDisplayDecimals = displayCurrencyHasSignificantMinorUnits({
    convertMoneyAmount,
    amountInMajorUnitOrSatsToMoneyAmount,
  })

  const currencyInfo: Record<WalletOrDisplayCurrency, CurrencyInfo> = useMemo(() => {
    return {
      [WalletCurrency.Usd]: {
        symbol: usdDisplayCurrency.symbol,
        minorUnitToMajorUnitOffset: usdDisplayCurrency.fractionDigits,
        showFractionDigits: true,
        currencyCode: usdDisplayCurrency.id,
      },
      [WalletCurrency.Btc]: {
        symbol: "",
        minorUnitToMajorUnitOffset: 0,
        showFractionDigits: false,
        currencyCode: "SAT",
      },
      [DisplayCurrency]: {
        symbol: displayCurrencyInfo.symbol,
        minorUnitToMajorUnitOffset: displayCurrencyInfo.fractionDigits,
        showFractionDigits: displayCurrencyShouldDisplayDecimals,
        currencyCode: displayCurrencyInfo.id,
      },
    }
  }, [displayCurrencyInfo, displayCurrencyShouldDisplayDecimals])

  const formatCurrency = useCallback(
    ({
      amountInMajorUnits,
      currency,
      withSign,
      currencyCode,
    }: {
      amountInMajorUnits: number | string
      currency: string
      withSign?: boolean
      currencyCode?: string
    }) => {
      const currencyInfo = displayCurrencyDictionary[currency] || {
        symbol: currency,
        fractionDigits: 2,
      }
      return formatCurrencyHelper({
        amountInMajorUnits,
        symbol: currencyInfo.symbol,
        fractionDigits: currencyInfo.fractionDigits,
        withSign,
        currencyCode,
      })
    },
    [displayCurrencyDictionary],
  )

  const formatMoneyAmount = useCallback(
    ({
      moneyAmount,
      noSymbol = false,
      noSuffix = false,
      isApproximate = false,
    }: {
      moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
      noSymbol?: boolean
      noSuffix?: boolean
      isApproximate?: boolean
    }): string => {
      const amount = moneyAmountToMajorUnitOrSats(moneyAmount)
      if (Number.isNaN(amount)) {
        return ""
      }

      const { symbol, minorUnitToMajorUnitOffset, showFractionDigits, currencyCode } =
        currencyInfo[moneyAmount.currency]

      if (
        moneyAmount.currency === DisplayCurrency &&
        currencyCode !== moneyAmount.currencyCode
      ) {
        // TODO: we should display the correct currency but this requires `showFractionDigits` to come from the backend
        return LL.common.currencySyncIssue()
      }

      return formatCurrencyHelper({
        amountInMajorUnits: amount,
        isApproximate,
        symbol: noSymbol ? "" : symbol,
        fractionDigits: showFractionDigits ? minorUnitToMajorUnitOffset : 0,
        currencyCode:
          moneyAmount.currency === WalletCurrency.Btc && !noSuffix
            ? currencyCode
            : undefined,
      })
    },
    [currencyInfo, moneyAmountToMajorUnitOrSats, LL],
  )

  const getSecondaryAmountIfCurrencyIsDifferent = useCallback(
    ({
      primaryAmount,
      displayAmount,
      walletAmount,
    }: {
      primaryAmount: MoneyAmount<WalletOrDisplayCurrency>
      displayAmount: DisplayAmount
      walletAmount: WalletAmount<WalletCurrency>
    }) => {
      // if the display currency is the same as the wallet amount currency, we don't need to show the secondary amount (example: USD display currency with USD wallet amount)
      if (walletAmount.currency === displayAmount.currencyCode) {
        return undefined
      }

      if (primaryAmount.currency === DisplayCurrency) {
        return walletAmount
      }

      return displayAmount
    },
    [],
  )

  const formatDisplayAndWalletAmount = useCallback(
    ({
      primaryAmount,
      displayAmount,
      walletAmount,
    }: {
      primaryAmount?: MoneyAmount<WalletOrDisplayCurrency>
      displayAmount: DisplayAmount
      walletAmount: WalletAmount<WalletCurrency>
    }) => {
      // if the primary amount is not provided, we use the display amount as the primary amount by default
      const primaryAmountWithDefault = primaryAmount || displayAmount

      const secondaryAmount = getSecondaryAmountIfCurrencyIsDifferent({
        primaryAmount: primaryAmountWithDefault,
        displayAmount,
        walletAmount,
      })

      if (secondaryAmount) {
        return `${formatMoneyAmount({
          moneyAmount: primaryAmountWithDefault,
        })} (${formatMoneyAmount({
          moneyAmount: secondaryAmount,
        })})`
      }

      return formatMoneyAmount({ moneyAmount: primaryAmountWithDefault })
    },
    [getSecondaryAmountIfCurrencyIsDifferent, formatMoneyAmount],
  )

  const moneyAmountToDisplayCurrencyString = useCallback(
    ({
      moneyAmount,
      isApproximate,
    }: {
      moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
      isApproximate?: boolean
    }): string | undefined => {
      if (!convertMoneyAmount) {
        return undefined
      }
      return formatMoneyAmount({
        moneyAmount: convertMoneyAmount(moneyAmount, DisplayCurrency),
        isApproximate,
      })
    },
    [convertMoneyAmount, formatMoneyAmount],
  )

  const getCurrencySymbol = useCallback(
    ({ currency }: { currency: string }) => {
      const currencyInfo = displayCurrencyDictionary[currency] || {
        symbol: currency,
        fractionDigits: 2,
      }
      return currencyInfo.symbol
    },
    [displayCurrencyDictionary],
  )

  const getFractionDigits = useCallback(
    ({ currency }: { currency: string }) => {
      const currencyInfo = displayCurrencyDictionary[currency] || {
        symbol: currency,
        fractionDigits: 2,
      }
      return currencyInfo.fractionDigits
    },
    [displayCurrencyDictionary],
  )

  return {
    fractionDigits: displayCurrencyInfo.fractionDigits,
    fiatSymbol: displayCurrencyInfo.symbol,
    displayCurrency,

    formatMoneyAmount,
    getSecondaryAmountIfCurrencyIsDifferent,
    formatDisplayAndWalletAmount,
    moneyAmountToDisplayCurrencyString,

    // TODO: remove export. we should only accept MoneyAmount instead of number as input
    // for exported functions for consistency
    displayCurrencyShouldDisplayDecimals,
    currencyInfo,
    moneyAmountToMajorUnitOrSats,
    zeroDisplayAmount: toDisplayMoneyAmount(0),

    formatCurrency,
    getCurrencySymbol,
    getFractionDigits,
  }
}
