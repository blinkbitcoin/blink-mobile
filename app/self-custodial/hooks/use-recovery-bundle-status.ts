import { useCallback, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { WalletCurrency } from "@app/graphql/generated"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { AccountType } from "@app/types/wallet"

import { readRecoveryBundleState } from "../recovery-bundle/storage"
import { useSparkNetwork } from "./use-spark-network"

/**
 * Age alone does not make a recovery backup wrong.
 *
 * The bundle records which outputs the wallet owns, and that only changes when
 * the user transacts - which is exactly when the refresh scheduler rebuilds it.
 * A wallet left untouched for a month therefore has a backup that describes it
 * perfectly, and warning about it would be a false alarm. False alarms are how
 * users learn to ignore the real one.
 *
 * So age is only a backstop, for the case a balance comparison cannot see: a
 * swap or consolidation that leaves the total unchanged while the underlying
 * outputs move. That is rare and self-correcting (the same operations trigger a
 * refresh), so the window is long and deliberately not the scheduler's 24h
 * fallback - that value is a good trigger to re-fetch, and a bad claim to make
 * to the user.
 */
export const BUNDLE_BACKSTOP_MS = 30 * 24 * 60 * 60 * 1000

export const RecoveryBundleStatus = {
  /** First read still in flight - render nothing rather than a wrong state. */
  Unknown: "unknown",
  /** No bundle yet. Normal for a wallet that has never received funds. */
  Missing: "missing",
  Stale: "stale",
  Fresh: "fresh",
} as const

export type RecoveryBundleStatus =
  (typeof RecoveryBundleStatus)[keyof typeof RecoveryBundleStatus]

type StatusInput = {
  savedAt: number | null
  /** Balance recorded when the bundle was built, in sats. */
  savedTotalSats: string | null
  /** Current wallet balance in sats, or null while it is still loading. */
  currentTotalSats: string | null
  /** Set when the wallet changed after this bundle was saved and no refresh
   *  has caught up yet, including one that failed. */
  uncoveredChangeAt: number | null
  now: number
  backstopMs?: number
}

export const statusFor = ({
  savedAt,
  savedTotalSats,
  currentTotalSats,
  uncoveredChangeAt,
  now,
  backstopMs = BUNDLE_BACKSTOP_MS,
}: StatusInput): RecoveryBundleStatus => {
  if (savedAt === null || savedTotalSats === null) return RecoveryBundleStatus.Missing

  /** The refresh scheduler already knows the wallet moved past this bundle,
   *  which a balance comparison can miss: a swap or consolidation changes the
   *  outputs and not the total, and a refresh that failed leaves the mark. */
  if (uncoveredChangeAt !== null) return RecoveryBundleStatus.Stale

  /** The balance moved, so the backup no longer describes the wallet - true
   *  even if it was written a minute ago. */
  if (currentTotalSats !== null && currentTotalSats !== savedTotalSats) {
    return RecoveryBundleStatus.Stale
  }

  /** A clock moved backwards makes the age negative; treat that as stale rather
   *  than fresh, so a wound-back clock cannot hide a backup from the backstop. */
  const age = now - savedAt
  if (age < 0 || age >= backstopMs) return RecoveryBundleStatus.Stale

  return RecoveryBundleStatus.Fresh
}

type RecoveryBundleStatusResult = {
  status: RecoveryBundleStatus
  savedAt: number | null
  leafCount: number | null
  /** True when the saved bundle has not left this device - this version was
   *  neither exported by the user nor uploaded to their cloud. The automatic
   *  on-device copy dies with the device, so this is "backed up" only in name. */
  isOnlyOnThisDevice: boolean
  /**
   * True only when the wallet is known to hold nothing a recovery backup could
   * recover, which is when warning about that backup is a false alarm. A wallet
   * emptied after a bundle was saved otherwise reports Stale forever: the
   * exporter refuses to rebuild with no leaves, so the recorded balance never
   * catches up with the zero.
   *
   * Bitcoin only, deliberately: the bundle records Bitcoin outputs and declares
   * Dollars not covered by a unilateral exit.
   *
   * Phrased as "known to hold nothing" rather than "has a balance" so a balance
   * still loading does not read as empty - that would suppress the surfaces on
   * every cold start, when the stored state can already answer on its own.
   * Owned here rather than by each surface, so the chip and the nudge cannot
   * disagree about it.
   */
  hasNothingToRecover: boolean
  reload: () => Promise<void>
}

type SavedBundle = {
  /** The account and network this read belongs to; null before any read lands. */
  forTarget: string | null
  savedAt: number | null
  savedTotalSats: string | null
  leafCount: number | null
  bundleCreatedAt: string | null
  cloudSyncedBundleCreatedAt: string | null
  exportedBundleCreatedAt: string | null
  uncoveredChangeAt: number | null
}

const NO_SAVED_BUNDLE: SavedBundle = {
  forTarget: null,
  savedAt: null,
  savedTotalSats: null,
  leafCount: null,
  bundleCreatedAt: null,
  cloudSyncedBundleCreatedAt: null,
  exportedBundleCreatedAt: null,
  uncoveredChangeAt: null,
}

/**
 * Freshness of the saved recovery bundle, shared by the settings chip and the
 * home nudge so the two can never disagree about whether a backup is current.
 *
 * Custodial accounts have no bundle at all and report Unknown, which renders
 * nothing - the surfaces are self-custodial only.
 */
export const useRecoveryBundleStatus = (): RecoveryBundleStatusResult => {
  const { activeAccount } = useAccountRegistry()
  const { wallets } = useActiveWallet()
  const network = useSparkNetwork()
  const [saved, setSaved] = useState<SavedBundle>(NO_SAVED_BUNDLE)
  const latestRead = useRef(0)

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  const target = accountId === null ? null : `${accountId}:${network}`

  /** wallets here is WalletState (MoneyAmount balances), not the GraphQL
   *  WalletBalance that getBtcWallet takes; this mirrors use-payment-request. */
  const btcWallet = wallets.find((w) => w.walletCurrency === WalletCurrency.Btc)
  const currentTotalSats =
    btcWallet === undefined ? null : String(btcWallet.balance.amount)

  const reload = useCallback(async () => {
    latestRead.current += 1
    const read = latestRead.current
    if (!accountId) {
      setSaved(NO_SAVED_BUNDLE)
      return
    }
    let next: SavedBundle
    try {
      const state = await readRecoveryBundleState(accountId, network)
      next = {
        forTarget: target,
        savedAt: state?.savedAt ?? null,
        savedTotalSats: state?.totalSats ?? null,
        leafCount: state?.leafCount ?? null,
        bundleCreatedAt: state?.bundleCreatedAt ?? null,
        cloudSyncedBundleCreatedAt: state?.cloudSyncedBundleCreatedAt ?? null,
        exportedBundleCreatedAt: state?.exportedBundleCreatedAt ?? null,
        uncoveredChangeAt: state?.uncoveredChangeAt ?? null,
      }
    } catch {
      /** An unreadable state file is indistinguishable from no backup, and the
       *  honest reading of "we cannot confirm you have one" is Missing. */
      next = { ...NO_SAVED_BUNDLE, forTarget: target }
    }
    /** A read overtaken by a newer one is dropped: after an account switch a
     *  slow read for the previous account would otherwise land last and show
     *  its backup against the new account's balance. */
    const isLatestRead = read === latestRead.current
    if (isLatestRead) setSaved(next)
  }, [accountId, network, target])

  /** Re-read on focus, which also covers the mount for both consumers: they are
   *  screens, and useFocusEffect runs its callback from its own effect when the
   *  screen is already focused. A separate mount effect would only double every
   *  read. A component mounting while blurred would wait for focus instead,
   *  which is the correct moment for a surface nobody is looking at. `reload`
   *  handles its own failures, so there is nothing to catch. */
  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  /** Until the active account's own read lands, a previous account's bundle
   *  says nothing about this one, so it reads as Unknown. */
  const isReadForTarget = target !== null && saved.forTarget === target
  const current = isReadForTarget ? saved : NO_SAVED_BUNDLE

  const status = isReadForTarget
    ? statusFor({
        savedAt: current.savedAt,
        savedTotalSats: current.savedTotalSats,
        currentTotalSats,
        uncoveredChangeAt: current.uncoveredChangeAt,
        now: Date.now(),
      })
    : RecoveryBundleStatus.Unknown

  /** Coverage is per version: an export or upload of an earlier bundle holds
   *  none of the outputs this one added, so it does not take it off the phone. */
  const isExportCurrent = current.exportedBundleCreatedAt === current.bundleCreatedAt
  const isCloudCopyCurrent =
    current.cloudSyncedBundleCreatedAt === current.bundleCreatedAt
  const isOnlyOnThisDevice =
    status !== RecoveryBundleStatus.Unknown &&
    status !== RecoveryBundleStatus.Missing &&
    !isExportCurrent &&
    !isCloudCopyCurrent

  return {
    status,
    savedAt: current.savedAt,
    leafCount: current.leafCount,
    isOnlyOnThisDevice,
    hasNothingToRecover: currentTotalSats === "0",
    reload,
  }
}
