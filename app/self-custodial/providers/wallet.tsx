import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AppState } from "react-native"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { recordAppError } from "@app/utils/error-reporting"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { NO_TRANSACTIONS, type NormalizedTransaction } from "@app/types/transaction"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet"

import { getLightningAddress } from "../bridge"
import { useSdkLifecycle } from "../hooks/use-sdk-lifecycle"
import { classifySdkError, SelfCustodialErrorCode } from "../sdk-error"
import {
  getSelfCustodialLightningAddress,
  setSelfCustodialLightningAddress,
} from "../storage/account-index"

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
  /** The active account's transactions only: empty on the commit where the connection
   *  still belongs to the account the user switched away from. */
  allTransactions: readonly NormalizedTransaction[]
  retry: () => void
  sdk: BreezSdkInterface | null
  /** The account the connected `sdk` belongs to, which is not always the active one: the
   *  provider's teardown runs after its descendants' effects, so on the commit where the
   *  user switches accounts a consumer sees the new active id beside the old connection.
   *  Anything that signs with the SDK and records the result elsewhere has to compare. */
  connectedAccountId: string | null
  lightningAddress: string | null
  isStableBalanceActive?: boolean
  /** Tag-aware `${tag}:${id}` key of the last payment event (dedupe that must
   * distinguish Pending from Succeeded for the same payment). */
  lastPaymentEventKey: string | null
  /** The payment id alone, for consumers that look payments up by id. */
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
  lastPaymentEventKey: null,
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
    lastPaymentEventKey,
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

  /** The account the SDK last answered for. An answer of "none" is null like the
   *  empty state before any answer, so this is what tells the two apart. */
  const sdkAnsweredForRef = useRef<string | null>(null)

  /** The account selected now, read after an await: a refresh started on one account
   *  can resolve after the user has switched to another. */
  const activeAccountIdRef = useRef(activeSelfCustodialAccountId)
  activeAccountIdRef.current = activeSelfCustodialAccountId

  useEffect(() => {
    sdkAnsweredForRef.current = null
    setLightningAddress(null)
  }, [activeSelfCustodialAccountId])

  /**
   * Seeds the address from what this device last recorded, before the SDK is asked.
   *
   * An address is a name the LNURL server answers for, not device state: it keeps
   * working for whoever pays it whether or not this device can currently ask about it.
   * Without this seed a launch with that server unreachable hides the user's own
   * address and the paycode tab with it, as though the name had been given up.
   *
   * The SDK's answer below overwrites this when it arrives, so a name changed on
   * another device still wins; this only fills the gap where there is no answer. A
   * seed read that lands after the answer is dropped, so it cannot put back an address
   * the SDK has just said the account no longer has.
   */
  useEffect(() => {
    if (!activeSelfCustodialAccountId) return undefined
    let mounted = true
    const accountId = activeSelfCustodialAccountId

    getSelfCustodialLightningAddress(accountId)
      .then((stored) => {
        const hasSdkAnswered = sdkAnsweredForRef.current === accountId
        if (!mounted || !stored || hasSdkAnswered) return
        setLightningAddress(stored)
      })
      .catch((err) => {
        reportLightningAddressError(LightningAddressOperation.Resolve, err)
      })

    return () => {
      mounted = false
    }
  }, [activeSelfCustodialAccountId])

  /**
   * Asked only while the connection is the active account's. On the commit where the
   * user switches, the active id has moved but the SDK still belongs to the account
   * being left, and its lookup can land after the switch: publishing it then would offer
   * that account's address, and its paycode, under the one now selected. The switch
   * re-runs this effect, so the cleanup drops a lookup already in flight.
   */
  const isSdkOnActiveAccount =
    Boolean(connectedAccountId) && connectedAccountId === activeSelfCustodialAccountId

  useEffect(() => {
    if (!sdk || !connectedAccountId || !isSdkOnActiveAccount) return undefined
    let mounted = true
    const accountId = connectedAccountId

    const resolveAndPersist = async () => {
      try {
        const info = await getLightningAddress(sdk)
        if (!mounted) return
        const resolved = info?.lightningAddress ?? null
        sdkAnsweredForRef.current = accountId
        setLightningAddress(resolved)
        /** Recorded even when there is none: the record is what the next launch seeds
         *  from, so an address the server no longer holds must not outlive it there. */
        await setSelfCustodialLightningAddress(accountId, resolved).catch((err) => {
          reportLightningAddressError(LightningAddressOperation.Persist, err)
        })
        if (mounted) await reloadSelfCustodialAccounts()
      } catch (err) {
        /** The seeded address stands: a question that could not be asked is not an
         *  answer that the account has none. */
        reportLightningAddressError(LightningAddressOperation.Resolve, err)
      }
    }

    resolveAndPersist()

    return () => {
      mounted = false
    }
  }, [sdk, connectedAccountId, isSdkOnActiveAccount, reloadSelfCustodialAccounts])

  /**
   * The answer is recorded under the account it was asked for whatever happens, but it
   * is only shown while that account is still the selected one, for the same reason the
   * lookup above is gated: otherwise a refresh that lands after a switch would offer the
   * previous account's address, and its paycode, under the new one.
   */
  const updateCurrentSelfCustodialAccount = useCallback(async () => {
    if (!sdk || !connectedAccountId) return
    const accountId = connectedAccountId
    try {
      const info = await getLightningAddress(sdk)
      const resolved = info?.lightningAddress ?? null
      const isStillActive = activeAccountIdRef.current === accountId
      if (isStillActive) {
        sdkAnsweredForRef.current = accountId
        setLightningAddress(resolved)
      }
      await setSelfCustodialLightningAddress(accountId, resolved)
      await reloadSelfCustodialAccounts()
    } catch (err) {
      reportLightningAddressError(LightningAddressOperation.Refresh, err)
    }
  }, [sdk, connectedAccountId, reloadSelfCustodialAccounts])

  /**
   * Published only while the connection is the active account's, like the address above.
   * On the commit where the user switches, the list still belongs to the account being
   * left, and a consumer that pairs it with the active account, such as the home badge
   * and its seen state, would announce that account's payment under the new one and
   * record it there as seen.
   */
  const activeAccountTransactions = isSdkOnActiveAccount
    ? allTransactions
    : NO_TRANSACTIONS

  const value = useMemo(
    (): SelfCustodialWalletContextValue => ({
      wallets,
      allTransactions: activeAccountTransactions,
      status,
      accountType: AccountType.SelfCustodial,
      retry,
      sdk,
      connectedAccountId,
      lightningAddress,
      isStableBalanceActive,
      lastPaymentEventKey,
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
      activeAccountTransactions,
      status,
      retry,
      sdk,
      connectedAccountId,
      lightningAddress,
      isStableBalanceActive,
      lastPaymentEventKey,
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
