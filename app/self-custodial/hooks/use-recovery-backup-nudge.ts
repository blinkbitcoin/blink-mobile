import { useCallback, useEffect, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import {
  RecoveryBundleStatus,
  useRecoveryBundleStatus,
} from "@app/self-custodial/hooks/use-recovery-bundle-status"
import { AccountType } from "@app/types/wallet"

const DISMISSAL_KEY_PREFIX = "recoveryBackupNudgeDismissedAt"

const dismissalKeyFor = (accountId: string) => `${DISMISSAL_KEY_PREFIX}:${accountId}`

export const RecoveryBackupNudgeVariant = {
  /** Funds on the wallet with no recovery backup saved at all. Automatic
   *  refresh should prevent this, so reaching it means refresh has been turned
   *  off or has been failing - the user has money that cannot be recovered if
   *  Spark goes offline. Not dismissible: the condition is not a reminder. */
  Missing: "missing",
  /** A backup exists but has fallen behind the wallet. A reminder, so it can
   *  be dismissed; it returns when the bundle goes stale again. */
  Stale: "stale",
  /** A bundle exists but has never left this device - not exported by the user,
   *  not uploaded to their cloud. It is "backed up" only in name: the automatic
   *  on-device copy is lost with the phone. This is the state a user reaches by
   *  skipping the export during onboarding, and the reason skipping is safe to
   *  offer at all. */
  OnlyOnThisDevice: "only-on-this-device",
} as const

export type RecoveryBackupNudgeVariant =
  (typeof RecoveryBackupNudgeVariant)[keyof typeof RecoveryBackupNudgeVariant]

type RecoveryBackupNudge = {
  variant: RecoveryBackupNudgeVariant | null
  dismiss: () => void
}

/**
 * Drives the home-screen recovery-backup banner.
 *
 * This is where the "every backup path ends with the bundle saved" requirement
 * is actually met: at onboarding the wallet is empty, so the exporter cannot
 * build a bundle and there is nothing to hand over. The first opportunity to
 * put a real backup in front of the user is here, once funds exist.
 */
export const useRecoveryBackupNudge = (hasBalance: boolean): RecoveryBackupNudge => {
  const { activeAccount } = useAccountRegistry()
  const { status, savedAt, isOnlyOnThisDevice } = useRecoveryBundleStatus()
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [dismissalLoaded, setDismissalLoaded] = useState(false)

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  useEffect(() => {
    if (!accountId) {
      setDismissalLoaded(true)
      return
    }
    let cancelled = false
    AsyncStorage.getItem(dismissalKeyFor(accountId))
      .then((raw) => {
        if (cancelled) return
        const parsed = raw === null ? NaN : Number(raw)
        setDismissedAt(Number.isFinite(parsed) ? parsed : null)
        setDismissalLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setDismissalLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [accountId])

  const dismiss = useCallback(() => {
    if (!accountId) return
    const now = Date.now()
    setDismissedAt(now)
    AsyncStorage.setItem(dismissalKeyFor(accountId), String(now)).catch(() => {})
  }, [accountId])

  const variant = ((): RecoveryBackupNudgeVariant | null => {
    if (!accountId || !dismissalLoaded) return null

    /** No bundle and no balance is the ordinary state of a fresh wallet, not a
     *  problem to nag about: there is nothing that could be backed up yet. */
    if (status === RecoveryBundleStatus.Missing) {
      return hasBalance ? RecoveryBackupNudgeVariant.Missing : null
    }

    /** A dismissal covers the state the user actually saw, not every future
     *  one: once the bundle is refreshed, the reminder returns. */
    const dismissalCoversThisBundle =
      dismissedAt !== null && savedAt !== null && dismissedAt > savedAt
    if (dismissalCoversThisBundle) return null

    /** Checked before staleness: a bundle that never left the device is a
     *  bigger problem than one that is merely out of date, and saying both at
     *  once would say neither well. */
    if (isOnlyOnThisDevice) return RecoveryBackupNudgeVariant.OnlyOnThisDevice

    if (status !== RecoveryBundleStatus.Stale) return null
    return RecoveryBackupNudgeVariant.Stale
  })()

  return { variant, dismiss }
}
