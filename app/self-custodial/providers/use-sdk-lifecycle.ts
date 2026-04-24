import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import type { BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { ActiveWalletStatus, type WalletState } from "@app/types/wallet.types"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { withTimeout } from "@app/utils/with-timeout"

import { addSdkEventListener, disconnectSdk, getUserSettings, initSdk } from "../bridge"
import { logSdkEvent, SdkLogLevel } from "../logging"

import { extractPaymentId, PAYMENT_RECEIVED_EVENTS, REFRESH_EVENTS } from "./sdk-events"
import { validateStoredNetwork } from "./validate-network"
import { getOnlineState, OnlineState, STATUS_TIMEOUT_MS } from "./is-online"
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
  refreshStableBalanceActive: () => Promise<void>
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
  const rawTxOffsetRef = useRef(0)

  // `refreshingRef` linearizes concurrent refreshes (10s poll, AppState change,
  // SDK events): only one runOnce executes at a time, and any overlapping call
  // sets `pendingRefreshRef` so the in-flight loop reruns once it returns. The
  // two require-atomic-updates disables below (post-await ref writes) are safe
  // under that invariant.
  const refreshWallets = useCallback(async () => {
    const sdk = sdkRef.current
    if (!sdk) return
    if (refreshingRef.current) {
      pendingRefreshRef.current = true
      return
    }
    refreshingRef.current = true

    const isStale = () => sdkRef.current !== sdk

    const runOnce = async () => {
      try {
        const snapshot = await withTimeout(
          getSelfCustodialWalletSnapshot(sdk, rawTxOffsetRef.current),
          STATUS_TIMEOUT_MS,
          "wallet snapshot",
        )
        if (isStale()) return
        setWallets(snapshot.wallets)
        setHasMoreTransactions(snapshot.hasMore)
        rawTxOffsetRef.current = snapshot.rawTransactionCount // eslint-disable-line require-atomic-updates
        // Snapshot success implies network reach; we skip a second `getServiceStatus()` here.
        setStatus(ActiveWalletStatus.Ready)
      } catch (err) {
        logSdkEvent(SdkLogLevel.Error, `Failed to refresh wallets: ${err}`)
        crashlytics().recordError(
          err instanceof Error ? err : new Error(`Refresh failed: ${err}`),
        )
        const onlineState = await getOnlineState()
        if (isStale()) return
        setStatus((prev) => {
          if (OFFLINE_EXEMPT_STATUSES.includes(prev)) return prev
          if (onlineState === OnlineState.Offline) return ActiveWalletStatus.Offline
          if (onlineState === OnlineState.Unknown) {
            crashlytics().log(
              `[SparkSDK] connectivity check failed; preserving previous status`,
            )
            if (prev === ActiveWalletStatus.Loading) return ActiveWalletStatus.Error
            return prev
          }
          if (prev === ActiveWalletStatus.Ready || prev === ActiveWalletStatus.Offline) {
            return ActiveWalletStatus.Offline
          }
          return prev === ActiveWalletStatus.Loading ? ActiveWalletStatus.Error : prev
        })
      }
    }

    try {
      do {
        pendingRefreshRef.current = false
        await runOnce()
      } while (pendingRefreshRef.current)
    } finally {
      refreshingRef.current = false // eslint-disable-line require-atomic-updates
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
      if (!mounted) return

      refreshWallets()

      getUserSettings(connectedSdk)
        .then((settings) => {
          if (mounted) {
            setIsStableBalanceActive(settings.stableBalanceActiveLabel !== undefined)
          }
        })
        .catch((err) => {
          logSdkEvent(SdkLogLevel.Error, `getUserSettings failed: ${err}`)
          crashlytics().recordError(new Error(`getUserSettings failed: ${err}`))
        })
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
      if (state !== "active") return
      refreshWallets().catch((err) => {
        crashlytics().recordError(
          err instanceof Error ? err : new Error(`AppState refresh failed: ${err}`),
        )
      })
    })
    return () => subscription.remove()
  }, [refreshWallets])

  useEffect(() => {
    const CONNECTIVITY_POLL_MS = 10000
    const interval = setInterval(() => {
      if (!sdkRef.current) return
      if (AppState.currentState !== "active") return
      refreshWallets().catch((err) => {
        crashlytics().recordError(
          err instanceof Error ? err : new Error(`Polling refresh failed: ${err}`),
        )
      })
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
      setIsStableBalanceActive(settings.stableBalanceActiveLabel !== undefined)
    } catch (err) {
      logSdkEvent(SdkLogLevel.Error, `Failed to refresh user settings: ${err}`)
      crashlytics().recordError(
        err instanceof Error ? err : new Error(`Refresh user settings failed: ${err}`),
      )
    }
  }, [])

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
    refreshStableBalanceActive,
  }
}
