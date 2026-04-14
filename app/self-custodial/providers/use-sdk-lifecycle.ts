import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import {
  Network,
  SdkEvent_Tags as SdkEventTags,
} from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { ActiveWalletStatus, type WalletState } from "@app/types/wallet.types"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { disconnectSdk, initSdk } from "../bridge"
import { SparkConfig } from "../config"
import { logSdkEvent, SdkLogLevel } from "../logging"

import { getSelfCustodialWalletSnapshot, loadMoreTransactions } from "./wallet-snapshot"

const REFRESH_EVENTS = new Set([
  SdkEventTags.Synced,
  SdkEventTags.PaymentSucceeded,
  SdkEventTags.PaymentPending,
  SdkEventTags.ClaimedDeposits,
  SdkEventTags.UnclaimedDeposits,
  SdkEventTags.NewDeposits,
])

type SdkLifecycleState = {
  wallets: WalletState[]
  status: ActiveWalletStatus
  sdk: Awaited<ReturnType<typeof initSdk>> | null
  hasMoreTransactions: boolean
  loadingMore: boolean
  loadMore: () => Promise<void>
}

export const useSdkLifecycle = (retryCount: number): SdkLifecycleState => {
  const [wallets, setWallets] = useState<WalletState[]>([])
  const [status, setStatus] = useState<ActiveWalletStatus>(ActiveWalletStatus.Unavailable)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const sdkRef = useRef<Awaited<ReturnType<typeof initSdk>> | null>(null)
  const refreshingRef = useRef(false)
  const pendingRefreshRef = useRef(false)

  const refreshWallets = useCallback(async () => {
    if (!sdkRef.current) return
    if (refreshingRef.current) {
      pendingRefreshRef.current = true
      return
    }
    refreshingRef.current = true

    try {
      const snapshot = await getSelfCustodialWalletSnapshot(sdkRef.current)
      setWallets(snapshot.wallets)
      setHasMoreTransactions(snapshot.hasMore)
      setStatus(ActiveWalletStatus.Ready)
    } catch (err) {
      logSdkEvent(SdkLogLevel.Error, `Failed to refresh wallets: ${err}`)
      crashlytics().log(`[SparkSDK] refresh failed: ${err}`)
    } finally {
      refreshingRef.current = false // eslint-disable-line require-atomic-updates
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false
        refreshWallets()
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      const mnemonic = await KeyStoreWrapper.getMnemonic()
      if (!mnemonic) {
        if (mounted) setStatus(ActiveWalletStatus.Unavailable)
        return
      }

      const storedNetwork = await KeyStoreWrapper.getMnemonicNetwork()
      const currentNetwork =
        SparkConfig.network === Network.Mainnet ? "mainnet" : "regtest"
      if (storedNetwork && storedNetwork !== currentNetwork) {
        logSdkEvent(
          SdkLogLevel.Error,
          `Network mismatch: wallet=${storedNetwork}, config=${currentNetwork}`,
        )
        crashlytics().recordError(
          new Error(
            `Network mismatch: wallet=${storedNetwork}, config=${currentNetwork}`,
          ),
        )
        if (mounted) setStatus(ActiveWalletStatus.Error)
        return
      }

      if (mounted) setStatus(ActiveWalletStatus.Loading)

      try {
        const sdk = await initSdk(mnemonic)
        if (!mounted) {
          await disconnectSdk(sdk)
          return
        }

        sdkRef.current = sdk

        await sdk.addEventListener({
          onEvent: async (event) => {
            if (!mounted) return
            if (REFRESH_EVENTS.has(event.tag)) {
              await refreshWallets()
            }
          },
        })

        await refreshWallets()
      } catch (err) {
        logSdkEvent(SdkLogLevel.Error, `SDK init failed: ${err}`)
        crashlytics().recordError(
          err instanceof Error ? err : new Error(`SDK init failed: ${err}`),
        )
        if (mounted) setStatus(ActiveWalletStatus.Error)
      }
    }

    initialize()

    return () => {
      mounted = false
      if (sdkRef.current) {
        disconnectSdk(sdkRef.current)
        sdkRef.current = null
      }
    }
  }, [retryCount, refreshWallets])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshWallets()
    })
    return () => subscription.remove()
  }, [refreshWallets])

  const loadMore = useCallback(async () => {
    if (!sdkRef.current || loadingMore || !hasMoreTransactions) return
    setLoadingMore(true)
    try {
      const currentCount = wallets.reduce((sum, w) => sum + w.transactions.length, 0)
      const result = await loadMoreTransactions(sdkRef.current, currentCount)
      setHasMoreTransactions(result.hasMore)
      setWallets((prev) =>
        prev.map((w) => ({
          ...w,
          transactions: [
            ...w.transactions,
            ...result.transactions.filter(
              (tx) => tx.amount.currency === w.walletCurrency,
            ),
          ],
        })),
      )
    } catch (err) {
      logSdkEvent(SdkLogLevel.Error, `Failed to load more transactions: ${err}`)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMoreTransactions, wallets])

  return {
    wallets,
    status,
    sdk: sdkRef.current,
    hasMoreTransactions,
    loadingMore,
    loadMore,
  }
}
