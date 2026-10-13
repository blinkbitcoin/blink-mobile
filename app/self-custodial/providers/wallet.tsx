import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { AppState } from "react-native"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { recordAppError } from "@app/utils/error-reporting"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { type NormalizedTransaction } from "@app/types/transaction"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet"

import { getLightningAddress } from "../bridge"
import { useSdkLifecycle } from "../hooks/use-sdk-lifecycle"
import { classifySdkError, SelfCustodialErrorCode } from "../sdk-error"
import { setSelfCustodialLightningAddress } from "../storage/account-index"

/**
 * The statuses a fresh start can actually clear, which is a narrower set than
 * the one the offline gate blocks on.
 *
 * Unavailable is deliberately left out. The lifecycle uses it for "this device
 * has no self-custodial wallet", which is where every custodial-only user
 * rests, with no SDK and nothing to connect — retrying it would re-run the
 * whole lifecycle on each foreground for people this feature does not touch,
 * and it is terminal for an account without a mnemonic too, so there is no
 * reading of it a retry could improve.
 */
const FOREGROUND_RETRYABLE_STATUSES: readonly ActiveWalletStatus[] = [
  ActiveWalletStatus.Offline,
  ActiveWalletStatus.Error,
]

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
  recordAppError(new Error(`Lightning address ${operation} failed: ${message}`), {
    expected: classifySdkError(err) === SelfCustodialErrorCode.NetworkError,
  })
}

type SelfCustodialWalletContextValue = ActiveWalletState & {
  allTransactions: NormalizedTransaction[]
  retry: () => void
  sdk: BreezSdkInterface | null
  /** The account the connected `sdk` belongs to, which is not always the active one: the
   *  provider's teardown runs after its descendants' effects, so on the commit where the
   *  user switches accounts a consumer sees the new active id beside the old connection.
   *  Anything that signs with the SDK and records the result elsewhere has to compare. */
  connectedAccountId: string | null
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
  allTransactions: [],
  status: ActiveWalletStatus.Unavailable,
  accountType: AccountType.SelfCustodial,
  retry: () => {},
  sdk: null,
  connectedAccountId: null,
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
  } = useSdkLifecycle(activeSelfCustodialAccountId, retryCount)

  const isStableBalanceActive = stableBalanceEnabled && sdkStableBalanceActive

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
  }, [])

  /**
   * Foregrounding the app is the first thing anyone tries, and until now it did
   * nothing for a wallet that never started: the lifecycle's own AppState
   * handler calls refreshWallets, which returns on its first line without an
   * SDK, and the backoff retry is gated the same way. The only working recovery
   * lived on a screen the user has to navigate into.
   *
   * Narrow on purpose: with a connected SDK this changes nothing, and the
   * lifecycle's refresh keeps handling the case this status usually means.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return
      if (sdk) return
      if (!FOREGROUND_RETRYABLE_STATUSES.includes(status)) return
      retry()
    })
    return () => subscription.remove()
  }, [sdk, status, retry])

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
      allTransactions,
      status,
      accountType: AccountType.SelfCustodial,
      retry,
      sdk,
      connectedAccountId,
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
      allTransactions,
      status,
      retry,
      sdk,
      connectedAccountId,
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
