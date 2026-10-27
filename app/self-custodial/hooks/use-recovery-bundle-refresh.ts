import { useCallback, useEffect, useRef } from "react"

import crashlytics from "@react-native-firebase/crashlytics"
import DeviceInfo from "react-native-device-info"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType, ActiveWalletStatus } from "@app/types/wallet"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import {
  RecoveryBundleExportError,
  RecoveryBundleExportErrorReason,
} from "../recovery-bundle/exporter"
import {
  isBundleFresh,
  markRecoveryBundleStale,
  refreshRecoveryBundle,
  syncExistingBundleToCloud,
} from "../recovery-bundle/refresh"
import { readRecoveryBundleSettings } from "../recovery-bundle/settings"
import { readRecoveryBundleState } from "../recovery-bundle/storage"
import {
  isPasswordProtectedCloudSeedBackup,
  useBackupState,
} from "../providers/backup-state"
import { useSelfCustodialWallet } from "../providers/wallet"

import { useSparkNetwork } from "./use-spark-network"

/**
 * Payments settle asynchronously (claims, swaps, leaf churn); waiting after the
 * last event lets a burst of activity produce one refresh of the final state.
 */
const PAYMENT_DEBOUNCE_MS = 15_000
/** Fallback refresh when no payment happened in a day - covers missed events. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000
/** Long enough to stay out of the cold-start contention window (SDK connect,
 * initial balance fetch, first render) on low-end devices. */
const STARTUP_DELAY_MS = 15_000
/**
 * A failed refresh leaves the payment it was covering absent from every saved
 * copy. The delay doubles per consecutive failure up to the cap, so a blip is
 * covered within a minute and an operator outage costs a handful of attempts
 * instead of a tight loop. After the last attempt the hook stops for this
 * session; the bundle keeps reading as out of date, so the next startup or
 * payment tries again.
 */
const RETRY_BASE_DELAY_MS = 60_000
const RETRY_MAX_DELAY_MS = 30 * 60_000
const MAX_RETRY_ATTEMPTS = 6

const retryDelayFor = (attempt: number): number =>
  Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS)

/** Saved, empty wallet, auto refresh off or no mnemonic settle a scheduled
 * refresh; only a failure leaves it owed. */
const RefreshOutcome = {
  Settled: "settled",
  Failed: "failed",
} as const

type RefreshOutcome = (typeof RefreshOutcome)[keyof typeof RefreshOutcome]

/** A refresh that is scheduled (timer set) or running (timer null). Its outcome
 * only counts while it is still the active one: a newer payment replaces it,
 * and an account switch or the wallet leaving Ready cancels it. */
type ActiveRefresh = {
  paymentEventKey: string | null
  timer: ReturnType<typeof setTimeout> | null
}

const isBenignExportError = (error: unknown): boolean =>
  error instanceof RecoveryBundleExportError &&
  error.reason === RecoveryBundleExportErrorReason.NoLeaves

/**
 * Keeps the unilateral-exit recovery bundle fresh: refreshes it after every
 * send/receive (the SDK's PaymentSucceeded fires for both directions) and on
 * startup when the saved bundle is stale or missing. The user can opt out of
 * automatic refresh (to save mobile data); the setting is checked when a
 * scheduled refresh fires, so a change on the Recovery Backup screen takes
 * effect without this hook remounting. Errors are recorded to crashlytics,
 * never surfaced - the Recovery Backup screen shows freshness and offers a
 * manual refresh.
 */
export const useRecoveryBundleRefresh = (): void => {
  const { activeAccount } = useAccountRegistry()
  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  const network = useSparkNetwork()
  const { status, lastPaymentEventKey } = useSelfCustodialWallet()
  const { backupState } = useBackupState()
  // Password-protected, not merely completed: the upload itself requires the
  // password gate (D9), so the trigger must key on the same condition - a
  // passwordless backup later redone with a password must fire the effect.
  const cloudSeedBackupActive = isPasswordProtectedCloudSeedBackup(backupState)

  const lastHandledEventKeyRef = useRef<string | null>(null)
  const activeRefreshRef = useRef<ActiveRefresh | null>(null)

  const cancelPendingRefresh = useCallback(() => {
    const cancelled = activeRefreshRef.current
    activeRefreshRef.current = null
    if (!cancelled?.timer) return
    clearTimeout(cancelled.timer)
    // The event was claimed when its timer was armed, but canceling the timer
    // before it fires means it was never handled. Let a subsequent Ready
    // render retry the same latest event.
    if (cancelled.paymentEventKey) lastHandledEventKeyRef.current = null
  }, [])

  const walletReady =
    status === ActiveWalletStatus.Ready || status === ActiveWalletStatus.Degraded

  // A pending timer closes over the previous account's id, network, and
  // mnemonic lookup, so it must not survive an account or network switch -
  // and the payment-id dedupe must restart, since payment ids are
  // per-account. Clearing on a network-only change also lets the new
  // network's startup-staleness check run instead of being suppressed by the
  // old network's still-active refresh.
  useEffect(() => {
    return () => {
      cancelPendingRefresh()
      lastHandledEventKeyRef.current = null
    }
  }, [accountId, network, cancelPendingRefresh])

  useEffect(() => {
    // No account, or the wallet dropped out of Ready: a pending refresh would
    // run against a signed-out account or a disconnected SDK, so cancel it
    // and wait for the next Ready render. Handling this here keeps the
    // scheduler the only effect that manages the timer besides the
    // identity-change cleanup above.
    if (!accountId || !walletReady) {
      cancelPendingRefresh()
      return undefined
    }
    const currentAccountId = accountId

    const runRefresh = async (coverageKey?: string): Promise<RefreshOutcome> => {
      const settings = await readRecoveryBundleSettings(currentAccountId)
      if (!settings.autoRefresh) return RefreshOutcome.Settled

      const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(currentAccountId)
      if (!mnemonic) return RefreshOutcome.Settled

      const result = await refreshRecoveryBundle({
        accountId: currentAccountId,
        network,
        mnemonic,
        appVersion: DeviceInfo.getReadableVersion(),
        // Names the payment this run has to cover, so a later payment is not
        // handed the in-flight run that fetched before it settled.
        coverageKey,
      })
      if (result.success) {
        crashlytics().log(`[recovery-bundle] refreshed: ${result.state.leafCount} leaves`)
        return RefreshOutcome.Settled
      }
      if (isBenignExportError(result.error)) {
        crashlytics().log("[recovery-bundle] refresh skipped: empty wallet")
        return RefreshOutcome.Settled
      }
      // recordError, not a breadcrumb: background failures are otherwise
      // invisible until the user happens to open the Recovery Backup screen.
      const wrapped =
        result.error instanceof Error ? result.error : new Error(String(result.error))
      crashlytics().recordError(wrapped, "recovery-bundle-refresh")
      return RefreshOutcome.Failed
    }

    const schedule = (
      delayMs: number,
      paymentEventKey: string | null = null,
      attempt = 0,
    ) => {
      cancelPendingRefresh()
      const refresh: ActiveRefresh = { paymentEventKey, timer: null }
      activeRefreshRef.current = refresh
      if (paymentEventKey) lastHandledEventKeyRef.current = paymentEventKey

      /**
       * The event stays claimed while its refresh runs, so a reconnect that
       * re-emits it does not start a second one. Only the active refresh acts
       * on its outcome and retries a failure. A replaced one leaves the event
       * to the newer refresh, whose fetch reads the same leaves and more, and
       * a cancelled one to the next Ready render, whose staleness check finds
       * the bundle still out of date.
       */
      const settle = (outcome: RefreshOutcome) => {
        if (activeRefreshRef.current !== refresh) return
        activeRefreshRef.current = null
        const isRetryOwed =
          outcome === RefreshOutcome.Failed && attempt < MAX_RETRY_ATTEMPTS
        if (isRetryOwed) schedule(retryDelayFor(attempt), paymentEventKey, attempt + 1)
      }

      refresh.timer = setTimeout(() => {
        refresh.timer = null
        runRefresh(paymentEventKey ?? undefined)
          .catch((err) => {
            crashlytics().recordError(
              err instanceof Error ? err : new Error(String(err)),
              "recovery-bundle-refresh",
            )
            return RefreshOutcome.Failed
          })
          .then(settle)
      }, delayMs)
    }

    // Event-driven: a payment completed or was claimed
    if (lastPaymentEventKey && lastPaymentEventKey !== lastHandledEventKeyRef.current) {
      /**
       * Marked now rather than when the debounce fires: the app can close in
       * between, or the refresh can fail and stop retrying, and the mark is
       * what keeps the next staleness check from reading the old bundle as
       * fresh.
       */
      markRecoveryBundleStale(currentAccountId, network).catch((err) => {
        crashlytics().log(`[recovery-bundle] stale mark failed: ${err}`)
      })
      schedule(PAYMENT_DEBOUNCE_MS, lastPaymentEventKey)
      return undefined
    }

    // Startup/staleness: no bundle yet, or last save older than the threshold.
    // Skipped while a refresh is scheduled or running, retries included.
    if (!activeRefreshRef.current) {
      // The read can settle after this render is gone (account switched or
      // wallet no longer Ready); without the guard it would arm a timer for
      // the old closure that nothing then cancels.
      let cancelled = false
      readRecoveryBundleState(currentAccountId, network)
        .then((state) => {
          if (cancelled) return
          if (isBundleFresh(state, Date.now(), STALE_AFTER_MS)) return
          schedule(STARTUP_DELAY_MS)
        })
        .catch((err) => {
          crashlytics().log(`[recovery-bundle] state read failed: ${err}`)
        })
      return () => {
        cancelled = true
      }
    }

    return undefined
  }, [accountId, network, walletReady, lastPaymentEventKey, cancelPendingRefresh])

  // When the user completes a cloud seed backup and the bundle on disk is not
  // the one in the cloud, sync it right away instead of waiting for the next
  // payment.
  useEffect(() => {
    if (!accountId || !cloudSeedBackupActive) return undefined
    let cancelled = false
    const currentAccountId = accountId

    readRecoveryBundleState(currentAccountId, network)
      .then(async (state) => {
        if (cancelled || !state) return
        /** A sync time alone says some bundle was uploaded once, not this one:
         *  every later save keeps it while the cloud still holds the older one. */
        const isCurrentBundleInCloud =
          state.cloudSyncedBundleCreatedAt === state.bundleCreatedAt
        if (isCurrentBundleInCloud) return
        await syncExistingBundleToCloud(currentAccountId, network)
      })
      .catch((err) => {
        crashlytics().log(`[recovery-bundle] cloud sync failed: ${err}`)
      })

    return () => {
      cancelled = true
    }
  }, [accountId, network, cloudSeedBackupActive])
}
