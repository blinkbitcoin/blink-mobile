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
import { getServiceStatus, isDegradedStatus, isOnlineStatus } from "./is-online"
import {
  appendTransactions,
  getSelfCustodialWalletSnapshot,
  loadMoreTransactions,
} from "./wallet-snapshot"

type SdkLifecycleState = {
  wallets: WalletState[]
  status: ActiveWalletStatus
  sdk: BreezSdkInterface | null
  sdkStableBalanceActive: boolean
  lastReceivedPaymentId: string | null
  hasMoreTransactions: boolean
  loadingMore: boolean
  loadMore: () => Promise<void>
  refreshWallets: () => Promise<void>
  refreshStableBalanceActive: () => Promise<void>
}

const OFFLINE_EXEMPT_STATUSES: readonly ActiveWalletStatus[] = [
  ActiveWalletStatus.Error,
  ActiveWalletStatus.Unavailable,
]

const RECONNECT_BACKOFF_MS: readonly number[] = [1000, 3000, 9000]

export const useSdkLifecycle = (retryCount: number): SdkLifecycleState => {
  const [wallets, setWallets] = useState<WalletState[]>([])
  const [status, setStatus] = useState<ActiveWalletStatus>(ActiveWalletStatus.Unavailable)
  const [sdkStableBalanceActive, setSdkStableBalanceActive] = useState(false)
  const [lastReceivedPaymentId, setLastReceivedPaymentId] = useState<string | null>(null)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sdk, setSdk] = useState<BreezSdkInterface | null>(null)
  const sdkRef = useRef<BreezSdkInterface | null>(null)
  const refreshingRef = useRef(false)
  const pendingRefreshRef = useRef(false)
  const rawTxOffsetRef = useRef(0)
  const failureCountRef = useRef(0)
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      rawTxOffsetRef.current = snapshot.rawTransactionCount
      const serviceStatus = await getServiceStatus()
      setStatus(
        isDegradedStatus(serviceStatus)
          ? ActiveWalletStatus.Degraded
          : ActiveWalletStatus.Ready,
      )
      failureCountRef.current = 0
      if (backoffTimerRef.current) {
        clearTimeout(backoffTimerRef.current)
        backoffTimerRef.current = null
      }
    } catch (err) {
      logSdkEvent(SdkLogLevel.Error, `Failed to refresh wallets: ${err}`)
      crashlytics().log(`[SparkSDK] refresh failed: ${err}`)
      const serviceStatus = await getServiceStatus()
      const online = isOnlineStatus(serviceStatus)
      setStatus((prev) => {
        if (OFFLINE_EXEMPT_STATUSES.includes(prev)) return prev
        return online ? ActiveWalletStatus.Error : ActiveWalletStatus.Offline
      })
      const attempt = failureCountRef.current
      if (attempt < RECONNECT_BACKOFF_MS.length) {
        const delay = RECONNECT_BACKOFF_MS[attempt]
        failureCountRef.current = attempt + 1
        if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current)
        backoffTimerRef.current = setTimeout(() => {
          backoffTimerRef.current = null
          if (sdkRef.current) refreshWallets()
        }, delay)
      }
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
            setSdkStableBalanceActive(settings.stableBalanceActiveLabel !== undefined)
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
      if (backoffTimerRef.current) {
        clearTimeout(backoffTimerRef.current)
        backoffTimerRef.current = null
      }
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
      if (AppState.currentState !== "active") return
      refreshWallets()
    }, CONNECTIVITY_POLL_MS)
    return () => clearInterval(interval)
  }, [refreshWallets])

  const loadMore = useCallback(async () => {
    if (!sdkRef.current || loadingMore || !hasMoreTransactions) return
    setLoadingMore(true)
    try {
      const result = await loadMoreTransactions(sdkRef.current, rawTxOffsetRef.current)
      rawTxOffsetRef.current += result.rawCount
      setHasMoreTransactions(result.hasMore)
      setWallets((prev) => appendTransactions(prev, result.transactions))
    } catch (err) {
      logSdkEvent(SdkLogLevel.Error, `Failed to load more transactions: ${err}`)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMoreTransactions])

  const refreshStableBalanceActive = useCallback(async () => {
    if (!sdkRef.current) return
    try {
      const settings = await getUserSettings(sdkRef.current)
      setSdkStableBalanceActive(settings.stableBalanceActiveLabel !== undefined)
    } catch (err) {
      logSdkEvent(SdkLogLevel.Error, `Failed to refresh user settings: ${err}`)
    }
  }, [])

  return {
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
  }
}
