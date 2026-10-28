import { useCallback, useEffect, useState } from "react"

import type { Network } from "@breeztech/breez-sdk-spark-react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { networkLabelFor } from "@app/self-custodial/config"
import {
  RecoveryBundleStatus,
  useRecoveryBundleStatus,
} from "@app/self-custodial/hooks/use-recovery-bundle-status"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { AccountType } from "@app/types/wallet"

const DISMISSAL_KEY_PREFIX = "recoveryBackupNudgeDismissedAt"

/** Per account and network, like the bundle state the reminder is about: a
 *  dismissal covers the backup the user saw, which lives on one network only. */
const dismissalKeyFor = (accountId: string, network: Network) =>
  `${DISMISSAL_KEY_PREFIX}:${networkLabelFor(network)}:${accountId}`

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

/** A dismissal together with the account and network it was read for, so one
 *  target's dismissal never stands in for another's while that one is loading. */
type Dismissal = { forTarget: string | null; dismissedAt: number | null }

const NO_DISMISSAL: Dismissal = { forTarget: null, dismissedAt: null }

/**
 * Drives the home-screen recovery-backup banner.
 *
 * This is where the "every backup path ends with the bundle saved" requirement
 * is actually met: at onboarding the wallet is empty, so the exporter cannot
 * build a bundle and there is nothing to hand over. The first opportunity to
 * put a real backup in front of the user is here, once funds exist.
 */
export const useRecoveryBackupNudge = (): RecoveryBackupNudge => {
  const { activeAccount } = useAccountRegistry()
  const { status, savedAt, isOnlyOnThisDevice, hasNothingToRecover } =
    useRecoveryBundleStatus()
  const [dismissal, setDismissal] = useState<Dismissal>(NO_DISMISSAL)

  const network = useSparkNetwork()

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  const target = accountId === null ? null : `${accountId}:${network}`

  useEffect(() => {
    if (!accountId) return
    const forTarget = `${accountId}:${network}`
    let cancelled = false
    AsyncStorage.getItem(dismissalKeyFor(accountId, network))
      .then((raw) => {
        if (cancelled) return
        const parsed = raw === null ? NaN : Number(raw)
        setDismissal({
          forTarget,
          dismissedAt: Number.isFinite(parsed) ? parsed : null,
        })
      })
      .catch(() => {
        /** An unreadable dismissal reads as none, so the reminder shows rather
         *  than staying hidden behind a dismissal this target never made. */
        if (!cancelled) setDismissal({ forTarget, dismissedAt: null })
      })
    return () => {
      cancelled = true
    }
  }, [accountId, network])

  const dismiss = useCallback(() => {
    if (!accountId) return
    const now = Date.now()
    setDismissal({ forTarget: `${accountId}:${network}`, dismissedAt: now })
    AsyncStorage.setItem(dismissalKeyFor(accountId, network), String(now)).catch(() => {})
  }, [accountId, network])

  const isDismissalLoaded = target !== null && dismissal.forTarget === target
  const { dismissedAt } = dismissal

  const variant = ((): RecoveryBackupNudgeVariant | null => {
    if (!isDismissalLoaded) return null

    /** No bundle and nothing to recover is the ordinary state of a fresh wallet,
     *  not a problem to nag about: there is nothing that could be backed up. */
    if (status === RecoveryBundleStatus.Missing) {
      return hasNothingToRecover ? null : RecoveryBackupNudgeVariant.Missing
    }

    /** A dismissal covers the state the user actually saw, not every future
     *  one: once the bundle is refreshed, the reminder returns. */
    const dismissalCoversThisBundle =
      dismissedAt !== null && savedAt !== null && dismissedAt > savedAt
    if (dismissalCoversThisBundle) return null

    /** Nothing left to lose and nothing to update: a wallet emptied after a
     *  bundle was saved reports Stale forever, because the exporter refuses to
     *  rebuild with no leaves and the recorded balance never catches up. */
    if (hasNothingToRecover) return null

    /** Checked before staleness: a bundle that never left the device is a
     *  bigger problem than one that is merely out of date, and saying both at
     *  once would say neither well. */
    if (isOnlyOnThisDevice) return RecoveryBackupNudgeVariant.OnlyOnThisDevice

    if (status !== RecoveryBundleStatus.Stale) return null
    return RecoveryBackupNudgeVariant.Stale
  })()

  return { variant, dismiss }
}
