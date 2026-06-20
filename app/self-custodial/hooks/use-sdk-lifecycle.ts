import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { type NormalizedTransaction } from "@app/types/transaction"
import { ActiveWalletStatus, type WalletState } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { withTimeout } from "@app/utils/with-timeout"

import {
  addSdkEventListener,
  disconnectSdk,
  getUserSettings,
  initSdk,
  removeSdkEventListener,
} from "../bridge"
import { storageDirFor } from "../config"
import { logSdkEvent, SdkLogLevel } from "../logging"
import {
  extractPaymentId,
  PAYMENT_RECEIVED_EVENTS,
  REFRESH_EVENTS,
} from "../providers/sdk-events"
import { validateStoredNetwork } from "../providers/validate-network"
import {
  getOnlineState,
  getServiceStatus,
  isDegradedStatus,
  OnlineState,
} from "../providers/is-online"
import {
  appendTransactions,
  getSelfCustodialWalletSnapshot,
  loadMoreTransactions,
  mergeOrderedTransactions,
} from "../providers/wallet-snapshot"

import { useBackoffRetry } from "./use-backoff-retry"
import { useSparkNetwork } from "./use-spark-network"

type SdkLifecycleState = {
  wallets: WalletState[]
  allTransactions: NormalizedTransaction[]
  status: ActiveWalletStatus
  sdk: BreezSdkInterface | null
  connectedAccountId: string | null
  sdkStableBalanceActive?: boolean
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
export const WALLET_SNAPSHOT_TIMEOUT_MS = 10000

const teardownSdk = async (
  sdk: BreezSdkInterface,
  listenerId: string | null,
): Promise<void> => {
  if (listenerId) await removeSdkEventListener(sdk, listenerId)
  await disconnectSdk(sdk)
}

export const useSdkLifecycle = (
  activeSelfCustodialAccountId: string | null,
  retryCount: number,
): SdkLifecycleState => {
  const network = useSparkNetwork()
  const [wallets, setWallets] = useState<WalletState[]>([])
  const [allTransactions, setAllTransactions] = useState<NormalizedTransaction[]>([])
  const [status, setStatus] = useState<ActiveWalletStatus>(ActiveWalletStatus.Unavailable)
  const [sdkStableBalanceActive, setSdkStableBalanceActive] = useState<boolean>()
  const [lastReceivedPaymentId, setLastReceivedPaymentId] = useState<string | null>(null)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sdk, setSdk] = useState<BreezSdkInterface | null>(null)
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null)
  const sdkRef = useRef<BreezSdkInterface | null>(null)
  const listenerIdRef = useRef<string | null>(null)
  const abortRef = useRef(false)
  const refreshingRef = useRef(false)
  const pendingRefreshRef = useRef(false)
  const rawTxOffsetRef = useRef(0)
  const { schedule: scheduleBackoffRetry, reset: resetBackoff } =
    useBackoffRetry(RECONNECT_BACKOFF_MS)

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
          WALLET_SNAPSHOT_TIMEOUT_MS,
          "wallet snapshot",
        )
        if (isStale()) return
        setWallets(snapshot.wallets)
        setAllTransactions(snapshot.allTransactions)
        setHasMoreTransactions(snapshot.hasMore)
        rawTxOffsetRef.current = snapshot.rawTransactionCount // eslint-disable-line require-atomic-updates

        const serviceStatus = await getServiceStatus()
        const nextStatus = isDegradedStatus(serviceStatus)
          ? ActiveWalletStatus.Degraded
          : ActiveWalletStatus.Ready
        setStatus(nextStatus)
        resetBackoff()
      } catch (err) {
        logSdkEvent(SdkLogLevel.Error, `Failed to refresh wallets: ${err}`)
        reportError("Refresh", err)
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
        scheduleBackoffRetry(() => {
          if (sdkRef.current) refreshWallets()
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
  }, [resetBackoff, scheduleBackoffRetry])

  useEffect(() => {
    if (!activeSelfCustodialAccountId) {
      setStatus(ActiveWalletStatus.Unavailable)
      setWallets([])
      setAllTransactions([])
      return
    }

    setStatus(ActiveWalletStatus.Loading)
    setWallets([])
    setAllTransactions([])

    let mounted = true
    abortRef.current = false
    const accountId = activeSelfCustodialAccountId

    const connectAndListen = async (mnemonic: string) => {
      const connectedSdk = await initSdk(
        mnemonic,
        storageDirFor(accountId, network),
        network,
      )
      if (abortRef.current || !mounted) {
        await teardownSdk(connectedSdk, null)
        return
      }

      sdkRef.current = connectedSdk
      setSdk(connectedSdk)
      setConnectedAccountId(accountId)

      const listenerId = await addSdkEventListener(connectedSdk, async (event) => {
        if (!mounted) return
        if (!REFRESH_EVENTS.has(event.tag)) return

        if (PAYMENT_RECEIVED_EVENTS.has(event.tag)) {
          const paymentId = extractPaymentId(event)
          if (paymentId) setLastReceivedPaymentId(paymentId)
        }
        await refreshWallets()
      })
      if (abortRef.current || !mounted) {
        await teardownSdk(connectedSdk, listenerId)
        return
      }
      listenerIdRef.current = listenerId

      refreshWallets()

      getUserSettings(connectedSdk)
        .then((settings) => {
          if (mounted) {
            setSdkStableBalanceActive(settings.stableBalanceActiveLabel !== undefined)
          }
        })
        .catch((err) => {
          logSdkEvent(SdkLogLevel.Error, `getUserSettings failed: ${err}`)
          crashlytics().recordError(new Error(`getUserSettings failed: ${err}`))
        })
    }

    const initialize = async () => {
      const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
      if (!mnemonic) {
        if (mounted) setStatus(ActiveWalletStatus.Unavailable)
        return
      }

      const networkValid = await validateStoredNetwork(accountId, network)
      if (!networkValid) {
        if (mounted) setStatus(ActiveWalletStatus.Error)
        return
      }

      if (mounted) setStatus(ActiveWalletStatus.Loading)
      await connectAndListen(mnemonic)
    }

    initialize().catch((err) => {
      logSdkEvent(SdkLogLevel.Error, `SDK init failed: ${err}`)
      reportError("SDK init", err)
      if (mounted) setStatus(ActiveWalletStatus.Error)
    })

    return () => {
      mounted = false
      abortRef.current = true
      resetBackoff()

      const sdk = sdkRef.current
      const listenerId = listenerIdRef.current
      sdkRef.current = null
      listenerIdRef.current = null
      setSdk(null)
      setConnectedAccountId(null)

      if (!sdk) return
      teardownSdk(sdk, listenerId).catch((err) => {
        reportError("SDK cleanup", err)
      })
    }
  }, [retryCount, refreshWallets, activeSelfCustodialAccountId, resetBackoff, network])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return
      refreshWallets().catch((err) => {
        reportError("AppState refresh", err)
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
        reportError("Polling refresh", err)
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
      setAllTransactions((prev) => mergeOrderedTransactions(prev, result.transactions))
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
      reportError("Refresh user settings", err)
    }
  }, [])

  return {
    wallets,
    allTransactions,
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
  }
}
