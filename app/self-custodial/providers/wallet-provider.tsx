import React, { createContext, useCallback, useContext, useMemo, useState } from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet.types"

import { useSdkLifecycle } from "./use-sdk-lifecycle"

type SelfCustodialWalletContextValue = ActiveWalletState & {
  retry: () => void
  sdk: BreezSdkInterface | null
  isStableBalanceActive: boolean
  isBalanceStale: boolean
  lastReceivedPaymentId: string | null
  hasMoreTransactions: boolean
  loadingMore: boolean
  loadMore: () => Promise<void>
  refreshWallets: () => Promise<void>
  refreshStableBalanceActive: () => Promise<void>
}

const noop = async () => {}

const defaultState: SelfCustodialWalletContextValue = {
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType: AccountType.SelfCustodial,
  retry: () => {},
  sdk: null,
  isStableBalanceActive: false,
  isBalanceStale: false,
  lastReceivedPaymentId: null,
  hasMoreTransactions: false,
  loadingMore: false,
  loadMore: noop,
  refreshWallets: noop,
  refreshStableBalanceActive: noop,
}

const SelfCustodialWalletContext =
  createContext<SelfCustodialWalletContextValue>(defaultState)

export const SelfCustodialWalletProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [retryCount, setRetryCount] = useState(0)
  const {
    wallets,
    status,
    sdk,
    isStableBalanceActive,
    isBalanceStale,
    lastReceivedPaymentId,
    hasMoreTransactions,
    loadingMore,
    loadMore,
    refreshWallets,
    refreshStableBalanceActive,
  } = useSdkLifecycle(retryCount)

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
  }, [])

  const value = useMemo(
    (): SelfCustodialWalletContextValue => ({
      wallets,
      status,
      accountType: AccountType.SelfCustodial,
      retry,
      sdk,
      isStableBalanceActive,
      isBalanceStale,
      lastReceivedPaymentId,
      hasMoreTransactions,
      loadingMore,
      loadMore,
      refreshWallets,
      refreshStableBalanceActive,
    }),
    [
      wallets,
      status,
      retry,
      sdk,
      isStableBalanceActive,
      isBalanceStale,
      lastReceivedPaymentId,
      hasMoreTransactions,
      loadingMore,
      loadMore,
      refreshWallets,
      refreshStableBalanceActive,
    ],
  )

  return (
    <SelfCustodialWalletContext.Provider value={value}>
      {children}
    </SelfCustodialWalletContext.Provider>
  )
}

export const useSelfCustodialWallet = (): SelfCustodialWalletContextValue =>
  useContext(SelfCustodialWalletContext)
