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
  refreshRecoveryBundle,
  syncExistingBundleToCloud,
} from "../recovery-bundle/refresh"
import { readRecoveryBundleState } from "../recovery-bundle/storage"
import { BackupMethod, BackupStatus, useBackupState } from "../providers/backup-state"
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
 * startup when the saved bundle is stale or missing. Errors are logged, never
 * surfaced - the Recovery Backup screen shows freshness and offers a manual
 * refresh.
 */
export const useRecoveryBundleRefresh = (): void => {
  const { activeAccount } = useAccountRegistry()
  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  const network = useSparkNetwork()
  const { status, lastReceivedPaymentId } = useSelfCustodialWallet()
  const { backupState } = useBackupState()
  const cloudSeedBackupActive =
    backupState.status === BackupStatus.Completed &&
    backupState.method === BackupMethod.Cloud

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHandledPaymentIdRef = useRef<string | null>(null)

  const walletReady =
    status === ActiveWalletStatus.Ready || status === ActiveWalletStatus.Degraded

  useEffect(() => {
    if (!accountId) return undefined
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
      } else if (!isBenignExportError(result.error)) {
        const message =
          result.error instanceof Error ? result.error.message : String(result.error)
        crashlytics().log(`[recovery-bundle] refresh failed: ${message}`)
      }
    }

    const schedule = (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        runRefresh().catch((err) => {
          crashlytics().log(`[recovery-bundle] refresh error: ${err}`)
        })
      }, delayMs)
    }

    // Event-driven: a payment completed or was claimed
    if (
      walletReady &&
      lastReceivedPaymentId &&
      lastReceivedPaymentId !== lastHandledPaymentIdRef.current
    ) {
      lastHandledPaymentIdRef.current = lastReceivedPaymentId
      schedule(PAYMENT_DEBOUNCE_MS)
      return undefined
    }

    // Startup/staleness: no bundle yet, or last save older than the threshold
    if (walletReady && !timerRef.current) {
      readRecoveryBundleState(currentAccountId)
        .then((state) => {
          if (state && Date.now() - state.savedAt < STALE_AFTER_MS) return
          schedule(STARTUP_DELAY_MS)
        })
        .catch(() => {})
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

    readRecoveryBundleState(currentAccountId)
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

  // Cancel pending work when the account disconnects or the app unmounts
  useEffect(() => {
    if (accountId && walletReady) return undefined
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [accountId, walletReady])
}
