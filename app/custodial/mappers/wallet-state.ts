import { type HomeAuthedQuery } from "@app/graphql/generated"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet"

import { mapCustodialWalletToWalletState } from "../adapters/wallet"
import { filterTransactionsByCurrency, mapCustodialTransactions } from "./transaction"

const createState = (
  status: ActiveWalletStatus,
  wallets: ActiveWalletState["wallets"] = [],
): ActiveWalletState => ({
  wallets,
  status,
  accountType: AccountType.Custodial,
})

const unavailable = createState(ActiveWalletStatus.Unavailable)

type MapContext = {
  loading: boolean
  error: boolean
  isAuthed: boolean
}

export const mapHomeDataToWalletState = (
  data: HomeAuthedQuery | undefined,
  { loading, error, isAuthed }: MapContext,
): ActiveWalletState => {
  if (!isAuthed) return unavailable
  if (loading && !data) return createState(ActiveWalletStatus.Loading)
  if (error && !data) return createState(ActiveWalletStatus.Error)

  const account = data?.me?.defaultAccount
  if (!account) return unavailable

  const wallets = account.wallets
  const txNodes = (account.transactions?.edges ?? []).map((edge) => edge.node)

  const btcWallet = getBtcWallet(wallets)
  const usdWallet = getUsdWallet(wallets)

  const btcTxs = btcWallet
    ? mapCustodialTransactions(
        filterTransactionsByCurrency(txNodes, btcWallet.walletCurrency),
        btcWallet.walletCurrency,
      )
    : []

  const usdTxs = usdWallet
    ? mapCustodialTransactions(
        filterTransactionsByCurrency(txNodes, usdWallet.walletCurrency),
        usdWallet.walletCurrency,
      )
    : []

  const walletStates = [
    ...(btcWallet ? [mapCustodialWalletToWalletState(btcWallet, btcTxs)] : []),
    ...(usdWallet ? [mapCustodialWalletToWalletState(usdWallet, usdTxs)] : []),
  ]

  return createState(ActiveWalletStatus.Ready, walletStates)
}
