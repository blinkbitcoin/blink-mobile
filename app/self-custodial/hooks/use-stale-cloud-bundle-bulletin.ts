import { useCallback, useRef, useState } from "react"

import type { Network } from "@breeztech/breez-sdk-spark-react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"

import { networkLabelFor } from "../config"
import { isCloudSeedBackupCompleted, useBackupState } from "../providers/backup-state"
import {
  readRecoveryBundleState,
  type RecoveryBundleState,
} from "../recovery-bundle/storage"

import { useSparkNetwork } from "./use-spark-network"

const DISMISSAL_KEY_PREFIX = "staleCloudBundleBulletinDismissedFor"

/** Per account and network, like the bundle state the bulletin is about. */
const dismissalKeyFor = (accountId: string, network: Network): string =>
  `${DISMISSAL_KEY_PREFIX}:${networkLabelFor(network)}:${accountId}`

/** Whether the cloud copy has trailed the one on this device for `staleAfterMs`. */
export const isCloudBundleStale = (
  state: RecoveryBundleState,
  now: number,
  staleAfterMs: number,
): boolean => {
  const isCloudCopyCurrent = state.cloudSyncedBundleCreatedAt === state.bundleCreatedAt
  if (isCloudCopyCurrent) return false
  /** The cloud was last current at its last upload. Never uploaded, it has
   *  trailed at least since the bundle on this device was saved. */
  const behindSince = state.cloudSyncedAt ?? state.savedAt
  return now - behindSince >= staleAfterMs
}

type BulletinRead = {
  /** The account and network this read belongs to; null before any read lands. */
  forTarget: string | null
  state: RecoveryBundleState | null
  /** The bundle the user dismissed the bulletin for, if any. */
  dismissedFor: string | null
}

const NOTHING_READ: BulletinRead = { forTarget: null, state: null, dismissedFor: null }

type StaleCloudBundleBulletin = {
  shouldShow: boolean
  dismiss: () => void
}

/**
 * The home bulletin for a cloud copy of the emergency bundle that stopped
 * updating. Uploads run in the background only, so a lapsed sign-in leaves the
 * cloud on an old bundle without a word; this says so and points back to the
 * cloud backup, which signs in again and uploads the bundle on the device.
 *
 * A dismissal covers the bundle the user saw: the bulletin comes back once a
 * newer bundle is saved and the cloud is still behind.
 */
export const useStaleCloudBundleBulletin = (): StaleCloudBundleBulletin => {
  const { activeAccount } = useAccountRegistry()
  const { backupState } = useBackupState()
  const network = useSparkNetwork()
  const { cloudBundleStaleAfterMs } = useRemoteConfig()
  const [read, setRead] = useState<BulletinRead>(NOTHING_READ)
  const latestRead = useRef(0)

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  const target = accountId === null ? null : `${accountId}:${network}`

  const reload = useCallback(async () => {
    latestRead.current += 1
    const readId = latestRead.current
    if (!accountId) return
    try {
      const [state, dismissedFor] = await Promise.all([
        readRecoveryBundleState(accountId, network),
        AsyncStorage.getItem(dismissalKeyFor(accountId, network)),
      ])
      /** A read overtaken by a newer one is dropped, so a slow read for the
       *  previous account cannot land last after a switch. */
      const isLatestRead = readId === latestRead.current
      if (isLatestRead) setRead({ forTarget: target, state, dismissedFor })
    } catch (err) {
      reportError("Stale cloud bundle bulletin read", err)
    }
  }, [accountId, network, target])

  /** The home re-reads on focus, which also covers the mount. */
  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  const isReadForTarget = target !== null && read.forTarget === target
  const { state } = read
  const isCloudBacked = isCloudSeedBackupCompleted(backupState)
  const isStale =
    state !== null && isCloudBundleStale(state, Date.now(), cloudBundleStaleAfterMs)
  const isDismissedForThisBundle =
    state !== null && read.dismissedFor === state.bundleCreatedAt
  const shouldShow =
    isReadForTarget && isCloudBacked && isStale && !isDismissedForThisBundle

  const dismiss = useCallback(() => {
    const isBundleShown = accountId !== null && state !== null
    if (!isBundleShown) return
    const { bundleCreatedAt } = state
    setRead((previous) => ({ ...previous, dismissedFor: bundleCreatedAt }))
    AsyncStorage.setItem(dismissalKeyFor(accountId, network), bundleCreatedAt).catch(
      (err) => reportError("Stale cloud bundle bulletin dismissal", err),
    )
  }, [accountId, network, state])

  return { shouldShow, dismiss }
}
