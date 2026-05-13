import { WalletCurrency } from "@app/graphql/generated"
import { type WalletBalance } from "@app/graphql/wallets-utils"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { type NormalizedTransaction } from "@app/types/transaction"
import { toWalletId, type WalletState } from "@app/types/wallet"

const toBalance = (amount: number, currency: WalletCurrency) => {
  if (currency === WalletCurrency.Btc) return toBtcMoneyAmount(amount)
  return toUsdMoneyAmount(amount)
}

export const mapCustodialWalletToWalletState = (
  wallet: WalletBalance,
  transactions: NormalizedTransaction[],
): WalletState => ({
  id: toWalletId(wallet.id),
  walletCurrency: wallet.walletCurrency,
  balance: toBalance(wallet.balance, wallet.walletCurrency),
  transactions,
})
