import { useCallback, useEffect, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"

import { readRecoveryBundleState } from "../recovery-bundle/storage"
import { useSparkNetwork } from "./use-spark-network"

/** Matches the refresh scheduler's own fallback window: a bundle the scheduler
 *  would already be re-fetching is exactly the one worth flagging, and two
 *  different thresholds would show "up to date" while a refresh was pending. */
export const BUNDLE_STALE_AFTER_MS = 24 * 60 * 60 * 1000

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

export const statusFor = (
  savedAt: number | null,
  now: number,
  staleAfterMs = BUNDLE_STALE_AFTER_MS,
): RecoveryBundleStatus => {
  if (savedAt === null) return RecoveryBundleStatus.Missing
  /** A clock moved backwards makes the age negative; treat that as stale rather
   *  than fresh, so a wound-back clock cannot hide an out-of-date backup. */
  const age = now - savedAt
  return age >= 0 && age < staleAfterMs
    ? RecoveryBundleStatus.Fresh
    : RecoveryBundleStatus.Stale
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
  const network = useSparkNetwork()
  const [state, setState] = useState<{
    status: RecoveryBundleStatus
    savedAt: number | null
    leafCount: number | null
  }>({ status: RecoveryBundleStatus.Unknown, savedAt: null, leafCount: null })

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  const reload = useCallback(async () => {
    if (!accountId) {
      setState({ status: RecoveryBundleStatus.Unknown, savedAt: null, leafCount: null })
      return
    }
    try {
      const saved = await readRecoveryBundleState(accountId, network)
      setState({
        status: statusFor(saved?.savedAt ?? null, Date.now()),
        savedAt: saved?.savedAt ?? null,
        leafCount: saved?.leafCount ?? null,
      })
    } catch {
      /** An unreadable state file is indistinguishable from no backup, and the
       *  honest reading of "we cannot confirm you have one" is Missing. */
      setState({ status: RecoveryBundleStatus.Missing, savedAt: null, leafCount: null })
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

  return { ...state, reload }
}
