import { WalletCurrency } from "@app/graphql/generated"
import { type MoneyAmount, type WalletOrDisplayCurrency } from "@app/types/amounts"

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

export const centsToTokenBaseUnits = (
  cents: number,
  tokenDecimals: number,
  displayDecimals = 2,
): number => {
  const excessDecimals = Math.max(tokenDecimals - displayDecimals, 0)
  return Math.round(cents * 10 ** excessDecimals)
}
