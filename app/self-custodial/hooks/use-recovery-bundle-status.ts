import { useCallback, useEffect, useState } from "react"

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
  now: number
  backstopMs?: number
}

export const statusFor = ({
  savedAt,
  savedTotalSats,
  currentTotalSats,
  now,
  backstopMs = BUNDLE_BACKSTOP_MS,
}: StatusInput): RecoveryBundleStatus => {
  if (savedAt === null || savedTotalSats === null) return RecoveryBundleStatus.Missing

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
  reload: () => Promise<void>
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
  const [saved, setSaved] = useState<{
    loaded: boolean
    savedAt: number | null
    savedTotalSats: string | null
    leafCount: number | null
  }>({ loaded: false, savedAt: null, savedTotalSats: null, leafCount: null })

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  const btcWallet = wallets.find((w) => w.walletCurrency === WalletCurrency.Btc)
  const currentTotalSats =
    btcWallet === undefined ? null : String(btcWallet.balance.amount)

  const reload = useCallback(async () => {
    if (!accountId) {
      setSaved({ loaded: false, savedAt: null, savedTotalSats: null, leafCount: null })
      return
    }
    try {
      const state = await readRecoveryBundleState(accountId, network)
      setSaved({
        loaded: true,
        savedAt: state?.savedAt ?? null,
        savedTotalSats: state?.totalSats ?? null,
        leafCount: state?.leafCount ?? null,
      })
    } catch {
      /** An unreadable state file is indistinguishable from no backup, and the
       *  honest reading of "we cannot confirm you have one" is Missing. */
      setSaved({ loaded: true, savedAt: null, savedTotalSats: null, leafCount: null })
    }
  }, [accountId, network])

  useEffect(() => {
    reload().catch(() => {})
  }, [reload])

  /** Re-read on focus: the bundle refreshes in the background after payments,
   *  so a chip rendered once at mount would go stale while on screen. */
  useFocusEffect(
    useCallback(() => {
      reload().catch(() => {})
    }, [reload]),
  )

  const status =
    !accountId || !saved.loaded
      ? RecoveryBundleStatus.Unknown
      : statusFor({
          savedAt: saved.savedAt,
          savedTotalSats: saved.savedTotalSats,
          currentTotalSats,
          now: Date.now(),
        })

  return { status, savedAt: saved.savedAt, leafCount: saved.leafCount, reload }
}
