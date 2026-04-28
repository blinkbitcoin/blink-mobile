import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { getLightningAddress } from "@app/self-custodial/bridge"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet.types"

import { useSdkLifecycle } from "./use-sdk-lifecycle"

type SelfCustodialWalletContextValue = ActiveWalletState & {
  retry: () => void
  sdk: BreezSdkInterface | null
  lightningAddress: string | null
  isStableBalanceActive: boolean
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
  lightningAddress: null,
  isStableBalanceActive: false,
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
  const { stableBalanceEnabled } = useFeatureFlags()
  const {
    wallets,
    status,
    sdk,
    sdkStableBalanceActive,
    lastReceivedPaymentId,
    hasMoreTransactions,
    loadingMore,
    loadMore,
    refreshWallets,
    refreshStableBalanceActive,
  } = useSdkLifecycle(retryCount)

  const isStableBalanceActive = stableBalanceEnabled && sdkStableBalanceActive

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
  }, [])

  const [lightningAddress, setLightningAddress] = useState<string | null>(null)

  useEffect(() => {
    if (!sdk) return undefined
    let mounted = true
    getLightningAddress(sdk)
      .then((info) => {
        if (!mounted) return
        setLightningAddress(info?.lightningAddress ?? null)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [sdk])

  const value = useMemo(
    (): SelfCustodialWalletContextValue => ({
      wallets,
      status,
      accountType: AccountType.SelfCustodial,
      retry,
      sdk,
      lightningAddress,
      isStableBalanceActive,
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
      lightningAddress,
      isStableBalanceActive,
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
