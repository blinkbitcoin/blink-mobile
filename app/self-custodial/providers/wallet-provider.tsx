import React, { createContext, useCallback, useContext, useMemo, useState } from "react"

import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet.types"

import { useSdkLifecycle } from "./use-sdk-lifecycle"

type SelfCustodialWalletContextValue = ActiveWalletState & {
  retry: () => void
}

const defaultState: SelfCustodialWalletContextValue = {
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType: AccountType.SelfCustodial,
  retry: () => {},
}

const SelfCustodialWalletContext =
  createContext<SelfCustodialWalletContextValue>(defaultState)

export const SelfCustodialWalletProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [retryCount, setRetryCount] = useState(0)
  const { wallets, status } = useSdkLifecycle(retryCount)

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
  }, [])

  const value = useMemo(
    (): SelfCustodialWalletContextValue => ({
      wallets,
      status,
      accountType: AccountType.SelfCustodial,
      retry,
    }),
    [wallets, status, retry],
  )

  return (
    <SelfCustodialWalletContext.Provider value={value}>
      {children}
    </SelfCustodialWalletContext.Provider>
  )
}

export const useSelfCustodialWallet = (): SelfCustodialWalletContextValue =>
  useContext(SelfCustodialWalletContext)
