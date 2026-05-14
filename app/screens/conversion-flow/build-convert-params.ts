import { WalletCurrency } from "@app/graphql/generated"
import { type MoneyAmount, type WalletOrDisplayCurrency } from "@app/types/amounts"
import {
  type ConvertParams,
  convertDirectionFromCurrency,
  oppositeWalletCurrency,
} from "@app/types/payment"

type ConvertMoneyAmountFn = <T extends WalletOrDisplayCurrency>(
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
  toCurrency: T,
) => MoneyAmount<T>

export const buildConvertParams = (
  fromAmount: MoneyAmount<WalletCurrency>,
  fromCurrency: WalletCurrency,
  convertMoneyAmount: ConvertMoneyAmountFn,
): ConvertParams => {
  const toCurrency = oppositeWalletCurrency(fromCurrency)
  return {
    fromAmount,
    toAmount: convertMoneyAmount(fromAmount, toCurrency),
    direction: convertDirectionFromCurrency(fromCurrency),
  }
}
