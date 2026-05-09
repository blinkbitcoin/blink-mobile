import { WalletCurrency } from "@app/graphql/generated"
import {
  DisplayCurrency,
  toUsdMoneyAmount,
  type DisplayCurrency as DisplayCurrencyType,
  type MoneyAmount,
  type WalletOrDisplayCurrency,
} from "@app/types/amounts"

type FormatUsdInDisplayDeps = {
  formatMoneyAmount: (args: {
    moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
  }) => string
  convertMoneyAmount?: (
    moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
    target: WalletCurrency | DisplayCurrencyType,
  ) => MoneyAmount<WalletOrDisplayCurrency>
}

// Formats a USD-cents amount in the user's display currency. When the
// price-conversion is not yet available, falls back to formatting the raw
// USD amount so the UI never blocks on price loading.
export const formatUsdInDisplay = (
  usdCents: number,
  { formatMoneyAmount, convertMoneyAmount }: FormatUsdInDisplayDeps,
): string => {
  const usdAmount = toUsdMoneyAmount(usdCents)
  if (!convertMoneyAmount) return formatMoneyAmount({ moneyAmount: usdAmount })
  return formatMoneyAmount({
    moneyAmount: convertMoneyAmount(usdAmount, DisplayCurrency),
  })
}

export const toSatsAmount = (
  amount: MoneyAmount<WalletOrDisplayCurrency>,
  convert: (
    amount: MoneyAmount<WalletOrDisplayCurrency>,
    currency: WalletCurrency,
  ) => MoneyAmount<WalletCurrency>,
): number => convert(amount, WalletCurrency.Btc).amount

export const tokenBaseUnitsToCentsExact = (
  rawAmount: number,
  tokenDecimals: number,
  displayDecimals = 2,
): number => {
  const excessDecimals = Math.max(tokenDecimals - displayDecimals, 0)
  return rawAmount / 10 ** excessDecimals
}

export const tokenBaseUnitsToCents = (
  rawAmount: number,
  tokenDecimals: number,
  displayDecimals = 2,
): number =>
  Math.round(tokenBaseUnitsToCentsExact(rawAmount, tokenDecimals, displayDecimals))

export const tokenBaseUnitsToCentsCeil = (
  rawAmount: number,
  tokenDecimals: number,
  displayDecimals = 2,
): number =>
  Math.ceil(tokenBaseUnitsToCentsExact(rawAmount, tokenDecimals, displayDecimals))

export const centsToTokenBaseUnits = (
  cents: number,
  tokenDecimals: number,
  displayDecimals = 2,
): number => {
  const excessDecimals = Math.max(tokenDecimals - displayDecimals, 0)
  return Math.round(cents * 10 ** excessDecimals)
}
