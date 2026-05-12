import { useMemo } from "react"

import { AccountType } from "@app/types/wallet"

import { useAccountRegistry } from "./use-account-registry"
import { useDisplayCurrency } from "./use-display-currency"
import { usePriceConversion } from "./use-price-conversion"

export const RatesStatus = {
  Available: "available",
  Unavailable: "unavailable",
  Loading: "loading",
} as const

export type RatesStatus = (typeof RatesStatus)[keyof typeof RatesStatus]

type MonetaryPreferencesResult = {
  displayCurrency: string
  fiatSymbol: string
  convertMoneyAmount: ReturnType<typeof usePriceConversion>["convertMoneyAmount"]
  ratesStatus: RatesStatus
  accountType: AccountType
}

export const useMonetaryPreferences = (): MonetaryPreferencesResult => {
  const { activeAccount } = useAccountRegistry()
  const accountType = activeAccount?.type ?? AccountType.Custodial
  const { getCurrencySymbol } = useDisplayCurrency()
  const priceConversion = usePriceConversion()

  return useMemo((): MonetaryPreferencesResult => {
    const ratesStatus = priceConversion.convertMoneyAmount
      ? RatesStatus.Available
      : RatesStatus.Unavailable

    return {
      displayCurrency: priceConversion.displayCurrency,
      fiatSymbol: getCurrencySymbol({
        currency: priceConversion.displayCurrency,
      }),
      convertMoneyAmount: priceConversion.convertMoneyAmount,
      ratesStatus,
      accountType,
    }
  }, [priceConversion, getCurrencySymbol, accountType])
}
