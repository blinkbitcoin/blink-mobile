import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import type { BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { ActiveWalletStatus, type WalletState } from "@app/types/wallet.types"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { addSdkEventListener, disconnectSdk, getUserSettings, initSdk } from "../bridge"
import { logSdkEvent, SdkLogLevel } from "../logging"

import { extractPaymentId, PAYMENT_RECEIVED_EVENTS, REFRESH_EVENTS } from "./sdk-events"
import { validateStoredNetwork } from "./validate-network"
import { isOnline } from "./is-online"
import {
  appendTransactions,
  getSelfCustodialWalletSnapshot,
  loadMoreTransactions,
} from "./wallet-snapshot"

type SdkLifecycleState = {
  wallets: WalletState[]
  status: ActiveWalletStatus
  sdk: BreezSdkInterface | null
  isStableBalanceActive: boolean
  lastReceivedPaymentId: string | null
  hasMoreTransactions: boolean
  loadingMore: boolean
  loadMore: () => Promise<void>
  refreshWallets: () => Promise<void>
}

const OFFLINE_EXEMPT_STATUSES: readonly ActiveWalletStatus[] = [
  ActiveWalletStatus.Error,
  ActiveWalletStatus.Unavailable,
]

export const useSdkLifecycle = (retryCount: number): SdkLifecycleState => {
  const [wallets, setWallets] = useState<WalletState[]>([])
  const [status, setStatus] = useState<ActiveWalletStatus>(ActiveWalletStatus.Unavailable)
  const [isStableBalanceActive, setIsStableBalanceActive] = useState(false)
  const [lastReceivedPaymentId, setLastReceivedPaymentId] = useState<string | null>(null)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sdk, setSdk] = useState<BreezSdkInterface | null>(null)
  const sdkRef = useRef<BreezSdkInterface | null>(null)
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
      const online = await isOnline()
      if (!online) {
        setStatus((prev) =>
          OFFLINE_EXEMPT_STATUSES.includes(prev) ? prev : ActiveWalletStatus.Offline,
        )
        return
      }

      const snapshot = await getSelfCustodialWalletSnapshot(sdkRef.current)
      setWallets(snapshot.wallets)
      setHasMoreTransactions(snapshot.hasMore)
      setStatus(ActiveWalletStatus.Ready)
    } catch (err) {
      logSdkEvent(SdkLogLevel.Error, `Failed to refresh wallets: ${err}`)
      crashlytics().log(`[SparkSDK] refresh failed: ${err}`)
      setStatus((prev) => {
        if (prev === ActiveWalletStatus.Ready || prev === ActiveWalletStatus.Offline) {
          return ActiveWalletStatus.Offline
        }
        return prev === ActiveWalletStatus.Loading ? ActiveWalletStatus.Ready : prev
      })
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

    const connectAndListen = async (mnemonic: string) => {
      const connectedSdk = await initSdk(mnemonic)
      if (!mounted) {
        await disconnectSdk(connectedSdk)
        return
      }

      sdkRef.current = connectedSdk
      setSdk(connectedSdk)

      await addSdkEventListener(connectedSdk, async (event) => {
        if (!mounted) return
        if (!REFRESH_EVENTS.has(event.tag)) return

        if (PAYMENT_RECEIVED_EVENTS.has(event.tag)) {
          const paymentId = extractPaymentId(event)
          if (paymentId) setLastReceivedPaymentId(paymentId)
        }
        await refreshWallets()
      })

      refreshWallets().catch(() => {})

      getUserSettings(connectedSdk)
        .then((settings) => {
          if (mounted) {
            setIsStableBalanceActive(settings.stableBalanceActiveLabel !== undefined)
          }
        })
        .catch(() => {})
    }

    const initialize = async () => {
      const mnemonic = await KeyStoreWrapper.getMnemonic()
      if (!mnemonic) {
        if (mounted) setStatus(ActiveWalletStatus.Unavailable)
        return
      }

      const networkValid = await validateStoredNetwork()
      if (!networkValid) {
        if (mounted) setStatus(ActiveWalletStatus.Error)
        return
      }

      if (mounted) setStatus(ActiveWalletStatus.Loading)
      await connectAndListen(mnemonic)
    }

    initialize().catch((err) => {
      logSdkEvent(SdkLogLevel.Error, `SDK init failed: ${err}`)
      crashlytics().recordError(
        err instanceof Error ? err : new Error(`SDK init failed: ${err}`),
      )
      if (mounted) setStatus(ActiveWalletStatus.Error)
    })

    return () => {
      mounted = false
      if (sdkRef.current) {
        disconnectSdk(sdkRef.current)
        sdkRef.current = null
        setSdk(null)
      }
    }
  }, [retryCount, refreshWallets])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshWallets()
    })
    return () => subscription.remove()
  }, [refreshWallets])

  useEffect(() => {
    const CONNECTIVITY_POLL_MS = 10000
    const interval = setInterval(() => {
      if (!sdkRef.current) return
      refreshWallets()
    }, CONNECTIVITY_POLL_MS)
    return () => clearInterval(interval)
  }, [refreshWallets])

  const loadMore = useCallback(async () => {
    if (!sdkRef.current || loadingMore || !hasMoreTransactions) return
    setLoadingMore(true)
    try {
      const currentCount = wallets.reduce((sum, w) => sum + w.transactions.length, 0)
      const result = await loadMoreTransactions(sdkRef.current, currentCount)
      setHasMoreTransactions(result.hasMore)
      setWallets((prev) => appendTransactions(prev, result.transactions))
    } catch (err) {
      logSdkEvent(SdkLogLevel.Error, `Failed to load more transactions: ${err}`)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMoreTransactions, wallets])

  return {
    wallets,
    status,
    sdk,
    isStableBalanceActive,
    lastReceivedPaymentId,
    hasMoreTransactions,
    loadingMore,
    loadMore,
    refreshWallets,
  }
}
