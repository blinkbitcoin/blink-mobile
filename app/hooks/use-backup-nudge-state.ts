import { useCallback, useEffect, useMemo, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"

import { useTotalBalance } from "@app/components/balance-header/use-total-balance"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { BackupStatus, useBackupState } from "@app/self-custodial/providers/backup-state"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"

import { useAccountRegistry } from "./use-account-registry"
import { useActiveWallet } from "./use-active-wallet"

const DISMISSAL_COOLDOWN_MS = 24 * 60 * 60 * 1000
const DISMISSAL_KEY_PREFIX = "backupNudgeDismissedAt"

const dismissalKeyFor = (accountId: string): string =>
  `${DISMISSAL_KEY_PREFIX}:${accountId}`

type BackupNudgeState = {
  shouldShowBanner: boolean
  shouldShowModal: boolean
  shouldShowSettingsBanner: boolean
  dismissBanner: () => void
}

export const useBackupNudgeState = (): BackupNudgeState => {
  const { backupState } = useBackupState()
  const activeWallet = useActiveWallet()
  const { activeAccount } = useAccountRegistry()
  const { backupNudgeBannerThreshold, backupNudgeModalThreshold } = useRemoteConfig()
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  const activeSelfCustodialAccountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  useEffect(() => {
    if (!activeSelfCustodialAccountId) {
      setDismissedAt(null)
      setLoaded(true)
      return
    }
    setLoaded(false)
    AsyncStorage.getItem(dismissalKeyFor(activeSelfCustodialAccountId)).then((raw) => {
      setDismissedAt(raw ? Number(raw) : null)
      setLoaded(true)
    })
  }, [activeSelfCustodialAccountId])

  const dismissBanner = useCallback(() => {
    if (!activeSelfCustodialAccountId) return
    const now = Date.now()
    setDismissedAt(now)
    AsyncStorage.setItem(
      dismissalKeyFor(activeSelfCustodialAccountId),
      String(now),
    ).catch((err) => {
      reportError("Nudge dismiss write", err)
    })
  }, [activeSelfCustodialAccountId])

  const isBackedUp = backupState.status === BackupStatus.Completed
  const isSelfCustodial = activeWallet.accountType === AccountType.SelfCustodial

  const walletsForTotal = useMemo(
    () =>
      activeWallet.wallets.map((w) => ({
        id: w.id,
        balance: w.balance.amount,
        walletCurrency: w.walletCurrency,
      })),
    [activeWallet.wallets],
  )

  const { satsBalance } = useTotalBalance(walletsForTotal)

  const isDismissedRecently =
    dismissedAt !== null && Date.now() - dismissedAt < DISMISSAL_COOLDOWN_MS

  const shouldShowModal =
    !isBackedUp && isSelfCustodial && loaded && satsBalance >= backupNudgeModalThreshold

  const shouldShowBanner =
    !isBackedUp &&
    isSelfCustodial &&
    loaded &&
    satsBalance >= backupNudgeBannerThreshold &&
    !shouldShowModal &&
    !isDismissedRecently

  const shouldShowSettingsBanner = !isBackedUp && isSelfCustodial

  return {
    shouldShowBanner,
    shouldShowModal,
    shouldShowSettingsBanner,
    dismissBanner,
  }
}
