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
  paymentReceivedCount: number
  hasMoreTransactions: boolean
  loadingMore: boolean
  loadMore: () => Promise<void>
}

const noop = async () => {}

const defaultState: SelfCustodialWalletContextValue = {
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType: AccountType.SelfCustodial,
  retry: () => {},
  sdk: null,
  isStableBalanceActive: false,
  paymentReceivedCount: 0,
  hasMoreTransactions: false,
  loadingMore: false,
  loadMore: noop,
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
    paymentReceivedCount,
    hasMoreTransactions,
    loadingMore,
    loadMore,
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
      paymentReceivedCount,
      hasMoreTransactions,
      loadingMore,
      loadMore,
    }),
    [
      wallets,
      status,
      retry,
      sdk,
      isStableBalanceActive,
      paymentReceivedCount,
      hasMoreTransactions,
      loadingMore,
      loadMore,
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
