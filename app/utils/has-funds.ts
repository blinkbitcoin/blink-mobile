import { type MoneyAmount, type WalletOrDisplayCurrency } from "@app/types/amounts"

export type WalletWithBalance = { balance: MoneyAmount<WalletOrDisplayCurrency> }

export const isFunded = (wallet: WalletWithBalance): boolean => wallet.balance.amount > 0

export const hasFunds = (wallets: ReadonlyArray<WalletWithBalance>): boolean =>
  wallets.some(isFunded)
