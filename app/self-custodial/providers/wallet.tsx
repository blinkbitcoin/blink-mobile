import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet"

import { getLightningAddress } from "../bridge"
import { useSdkLifecycle } from "../hooks/use-sdk-lifecycle"
import { setSelfCustodialLightningAddress } from "../storage/account-index"

const LightningAddressOperation = {
  Resolve: "resolve",
  Persist: "persist",
  Refresh: "refresh",
} as const

type LightningAddressOperation =
  (typeof LightningAddressOperation)[keyof typeof LightningAddressOperation]

const reportLightningAddressError = (
  operation: LightningAddressOperation,
  err: unknown,
): void => {
  const message = err instanceof Error ? err.message : String(err)
  crashlytics().recordError(
    new Error(`Lightning address ${operation} failed: ${message}`),
  )
}

type SelfCustodialWalletContextValue = ActiveWalletState & {
  retry: () => void
  sdk: BreezSdkInterface | null
  lightningAddress: string | null
  isStableBalanceActive?: boolean
  lastReceivedPaymentId: string | null
  hasMoreTransactions: boolean
  loadingMore: boolean
  loadMore: () => Promise<void>
  refreshWallets: () => Promise<void>
  refreshStableBalanceActive: () => Promise<void>
  updateCurrentSelfCustodialAccount: () => Promise<void>
}

const noop = async () => {}

const defaultState: SelfCustodialWalletContextValue = {
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType: AccountType.SelfCustodial,
  retry: () => {},
  sdk: null,
  lightningAddress: null,
  lastReceivedPaymentId: null,
  hasMoreTransactions: false,
  loadingMore: false,
  loadMore: noop,
  refreshWallets: noop,
  refreshStableBalanceActive: noop,
  updateCurrentSelfCustodialAccount: noop,
}

const SelfCustodialWalletContext =
  createContext<SelfCustodialWalletContextValue>(defaultState)

export const SelfCustodialWalletProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { activeAccount, reloadSelfCustodialAccounts } = useAccountRegistry()
  const activeSelfCustodialAccountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  const [retryCount, setRetryCount] = useState(0)
  const { stableBalanceEnabled } = useFeatureFlags()
  const {
    wallets,
    status,
    sdk,
    connectedAccountId,
    sdkStableBalanceActive,
    lastReceivedPaymentId,
    hasMoreTransactions,
    loadingMore,
    loadMore,
    refreshWallets,
    refreshStableBalanceActive,
  } = useSdkLifecycle(activeSelfCustodialAccountId, retryCount)

  const isStableBalanceActive = stableBalanceEnabled && sdkStableBalanceActive

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
  }, [])

  const [lightningAddress, setLightningAddress] = useState<string | null>(null)

  useEffect(() => {
    setLightningAddress(null)
  }, [activeSelfCustodialAccountId])

  useEffect(() => {
    if (!sdk || !connectedAccountId) return undefined
    let mounted = true
    const accountId = connectedAccountId

    const resolveAndPersist = async () => {
      try {
        const info = await getLightningAddress(sdk)
        if (!mounted) return
        const resolved = info?.lightningAddress ?? null
        setLightningAddress(resolved)
        if (!resolved) return
        await setSelfCustodialLightningAddress(accountId, resolved).catch((err) => {
          reportLightningAddressError(LightningAddressOperation.Persist, err)
        })
        if (mounted) await reloadSelfCustodialAccounts()
      } catch (err) {
        reportLightningAddressError(LightningAddressOperation.Resolve, err)
      }
    }

    resolveAndPersist()

    return () => {
      mounted = false
    }
  }, [sdk, connectedAccountId, reloadSelfCustodialAccounts])

  const updateCurrentSelfCustodialAccount = useCallback(async () => {
    if (!sdk || !connectedAccountId) return
    try {
      const info = await getLightningAddress(sdk)
      const resolved = info?.lightningAddress ?? null
      setLightningAddress(resolved)
      await setSelfCustodialLightningAddress(connectedAccountId, resolved)
      await reloadSelfCustodialAccounts()
    } catch (err) {
      reportLightningAddressError(LightningAddressOperation.Refresh, err)
    }
  }, [sdk, connectedAccountId, reloadSelfCustodialAccounts])

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
      updateCurrentSelfCustodialAccount,
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
      updateCurrentSelfCustodialAccount,
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
