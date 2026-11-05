import { Wallet, WalletCurrency } from "@app/graphql/generated"
import { CARD, CardCurrency } from "@app/types/amounts"

export type WalletBalance = Pick<Wallet, "id" | "walletCurrency" | "balance">

type CardBalance = {
  id: string
  walletCurrency: CardCurrency
  balance: number
}

export type AccountBalance = WalletBalance | CardBalance

export const getWallets = (accounts: readonly AccountBalance[] | undefined) =>
  accounts?.filter((account): account is WalletBalance => account.walletCurrency !== CARD)

export const getCardAccount = (accounts: readonly AccountBalance[] | undefined) =>
  accounts?.find((account): account is CardBalance => account.walletCurrency === CARD)

export const getBtcWallet = (wallets: readonly WalletBalance[] | undefined) => {
  if (wallets === undefined || wallets.length === 0) {
    return undefined
  }

  return wallets.find((wallet) => wallet.walletCurrency === WalletCurrency.Btc)
}

export const getUsdWallet = (wallets: readonly WalletBalance[] | undefined) => {
  if (wallets === undefined || wallets.length === 0) {
    return undefined
  }

  return wallets.find((wallet) => wallet.walletCurrency === WalletCurrency.Usd)
}

export const getWalletIds = (wallets: readonly WalletBalance[] | undefined): string[] =>
  [getBtcWallet(wallets)?.id, getUsdWallet(wallets)?.id].filter((id): id is string =>
    Boolean(id),
  )

export const getDefaultWallet = (
  wallets: readonly WalletBalance[] | undefined,
  defaultWalletId: string | undefined,
) => {
  if (wallets === undefined || wallets.length === 0) {
    return undefined
  }

  return wallets.find((wallet) => wallet.id === defaultWalletId)
}
