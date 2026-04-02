import React, { createContext, useContext, useMemo } from "react"

import { useHomeAuthedQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet.types"

import { mapCustodialWalletToWalletState } from "../adapters/wallet-adapter"
import { mapCustodialTransactions } from "../mappers/transaction-mapper"

const createCustodialState = (
  status: ActiveWalletStatus,
  wallets: ActiveWalletState["wallets"] = [],
): ActiveWalletState => ({
  wallets,
  status,
  accountType: AccountType.Custodial,
})

const defaultState = createCustodialState(ActiveWalletStatus.Unavailable)

const CustodialWalletContext = createContext<ActiveWalletState>(defaultState)

export const CustodialWalletProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const isAuthed = useIsAuthed()
  const { data, loading, error } = useHomeAuthedQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-and-network",
  })

  const walletState = useMemo((): ActiveWalletState => {
    if (!isAuthed) return defaultState
    if (loading && !data) return createCustodialState(ActiveWalletStatus.Loading)
    if (error && !data) return createCustodialState(ActiveWalletStatus.Error)

    const account = data?.me?.defaultAccount
    if (!account) return defaultState

    const wallets = account.wallets
    const txEdges = account.transactions?.edges ?? []
    const txNodes = txEdges.map((edge) => edge.node)

    const btcWallet = getBtcWallet(wallets)
    const usdWallet = getUsdWallet(wallets)

    const btcTxs = btcWallet
      ? mapCustodialTransactions(
          txNodes.filter((tx) => tx.settlementCurrency === btcWallet.walletCurrency),
          btcWallet.walletCurrency,
        )
      : []

    const usdTxs = usdWallet
      ? mapCustodialTransactions(
          txNodes.filter((tx) => tx.settlementCurrency === usdWallet.walletCurrency),
          usdWallet.walletCurrency,
        )
      : []

    const walletStates = [
      ...(btcWallet ? [mapCustodialWalletToWalletState(btcWallet, btcTxs)] : []),
      ...(usdWallet ? [mapCustodialWalletToWalletState(usdWallet, usdTxs)] : []),
    ]

    return createCustodialState(ActiveWalletStatus.Ready, walletStates)
  }, [isAuthed, loading, error, data])

  return (
    <CustodialWalletContext.Provider value={walletState}>
      {children}
    </CustodialWalletContext.Provider>
  )
}

export const useCustodialWallet = (): ActiveWalletState =>
  useContext(CustodialWalletContext)
