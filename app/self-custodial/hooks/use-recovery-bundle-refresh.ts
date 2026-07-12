import { useEffect, useRef } from "react"

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
  refreshRecoveryBundle,
  syncExistingBundleToCloud,
} from "../recovery-bundle/refresh"
import { readRecoveryBundleState } from "../recovery-bundle/storage"
import { isCloudSeedBackupCompleted, useBackupState } from "../providers/backup-state"
import { useSelfCustodialWallet } from "../providers/wallet"

import { useSparkNetwork } from "./use-spark-network"

/**
 * Payments settle asynchronously (claims, swaps, leaf churn); waiting after the
 * last event lets a burst of activity produce one refresh of the final state.
 */
const PAYMENT_DEBOUNCE_MS = 15_000
/** Fallback refresh when no payment happened in a day - covers missed events. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000
const STARTUP_DELAY_MS = 5_000

const isBenignExportError = (error: unknown): boolean =>
  error instanceof RecoveryBundleExportError &&
  error.reason === RecoveryBundleExportErrorReason.NoLeaves

/**
 * Keeps the unilateral-exit recovery bundle fresh: refreshes it after every
 * send/receive (the SDK's PaymentSucceeded fires for both directions) and on
 * startup when the saved bundle is stale or missing. Errors are recorded to
 * crashlytics, never surfaced - the Recovery Backup screen shows freshness
 * and offers a manual refresh.
 */
export const useRecoveryBundleRefresh = (): void => {
  const { activeAccount } = useAccountRegistry()
  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  const network = useSparkNetwork()
  const { status, lastReceivedPaymentId } = useSelfCustodialWallet()
  const { backupState } = useBackupState()
  const cloudSeedBackupActive = isCloudSeedBackupCompleted(backupState)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHandledPaymentIdRef = useRef<string | null>(null)

  const walletReady =
    status === ActiveWalletStatus.Ready || status === ActiveWalletStatus.Degraded

  // A pending timer closes over the previous account's id, network, and
  // mnemonic lookup, so it must not survive an account or network switch -
  // and the payment-id dedupe must restart, since payment ids are
  // per-account. Clearing on a network-only change also lets the new
  // network's startup-staleness check run instead of being suppressed by the
  // old timer's non-null ref.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      lastHandledPaymentIdRef.current = null
    }
  }, [accountId, network])

  useEffect(() => {
    // No account, or the wallet dropped out of Ready: a pending refresh would
    // run against a signed-out account or a disconnected SDK, so cancel it
    // and wait for the next Ready render. Handling this here keeps the
    // scheduler the only effect that manages the timer besides the
    // identity-change cleanup above.
    if (!accountId || !walletReady) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return undefined
    }
    const currentAccountId = accountId

    const runRefresh = async () => {
      const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(currentAccountId)
      if (!mnemonic) return

      const result = await refreshRecoveryBundle({
        accountId: currentAccountId,
        network,
        mnemonic,
        appVersion: DeviceInfo.getReadableVersion(),
      })
      if (result.success) {
        crashlytics().log(`[recovery-bundle] refreshed: ${result.state.leafCount} leaves`)
      } else if (isBenignExportError(result.error)) {
        crashlytics().log("[recovery-bundle] refresh skipped: empty wallet")
      } else {
        // recordError, not a breadcrumb: background failures are otherwise
        // invisible until the user happens to open the Recovery Backup screen.
        const wrapped =
          result.error instanceof Error ? result.error : new Error(String(result.error))
        crashlytics().recordError(wrapped, "recovery-bundle-refresh")
      }
    }

    const schedule = (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        runRefresh().catch((err) => {
          crashlytics().recordError(
            err instanceof Error ? err : new Error(String(err)),
            "recovery-bundle-refresh",
          )
        })
      }, delayMs)
    }

    // Event-driven: a payment completed or was claimed
    if (
      lastReceivedPaymentId &&
      lastReceivedPaymentId !== lastHandledPaymentIdRef.current
    ) {
      lastHandledPaymentIdRef.current = lastReceivedPaymentId
      schedule(PAYMENT_DEBOUNCE_MS)
      return undefined
    }

    // Startup/staleness: no bundle yet, or last save older than the threshold
    if (!timerRef.current) {
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
  }, [accountId, network, walletReady, lastReceivedPaymentId])

  // When the user completes a cloud seed backup and a bundle is already on
  // disk but never uploaded, sync it right away instead of waiting for the
  // next payment.
  useEffect(() => {
    if (!accountId || !cloudSeedBackupActive) return undefined
    let cancelled = false
    const currentAccountId = accountId

    readRecoveryBundleState(currentAccountId, network)
      .then(async (state) => {
        if (cancelled || !state || state.cloudSyncedAt) return
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
