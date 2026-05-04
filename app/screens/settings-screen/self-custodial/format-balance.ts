import { type MoneyAmount, type WalletOrDisplayCurrency } from "@app/types/amounts"

export type WalletWithBalance = { balance: MoneyAmount<WalletOrDisplayCurrency> }

export type FormatMoneyAmountFn = (params: {
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
}) => string

export const formatBalance = (
  wallets: ReadonlyArray<WalletWithBalance>,
  formatMoneyAmount: FormatMoneyAmountFn,
): string =>
  wallets
    .filter((w) => w.balance.amount > 0)
    .map((w) => formatMoneyAmount({ moneyAmount: w.balance }))
    .join(" + ")
