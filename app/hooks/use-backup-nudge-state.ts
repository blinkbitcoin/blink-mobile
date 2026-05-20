import { useCallback, useEffect, useMemo, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"
import crashlytics from "@react-native-firebase/crashlytics"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import {
  BackupStatus,
  useBackupState,
} from "@app/self-custodial/providers/backup-state-provider"
import { AccountType } from "@app/types/wallet.types"

const DISMISSAL_COOLDOWN_MS = 24 * 60 * 60 * 1000
const DISMISSAL_KEY = "backupNudgeDismissedAt"

type BackupNudgeState = {
  shouldShowBanner: boolean
  shouldShowModal: boolean
  shouldShowSettingsBanner: boolean
  dismissBanner: () => void
}

export const useBackupNudgeState = (): BackupNudgeState => {
  const { backupState } = useBackupState()
  const activeWallet = useActiveWallet()
  const { backupNudgeBannerThreshold, backupNudgeModalThreshold } = useRemoteConfig()
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(DISMISSAL_KEY).then((raw) => {
      if (raw) setDismissedAt(Number(raw))
      setLoaded(true)
    })
  }, [])

  const dismissBanner = useCallback(() => {
    const now = Date.now()
    setDismissedAt(now)
    AsyncStorage.setItem(DISMISSAL_KEY, String(now)).catch((err) => {
      crashlytics().recordError(
        err instanceof Error ? err : new Error(`Nudge dismiss write failed: ${err}`),
      )
    })
  }, [])

  const isBackedUp = backupState.status === BackupStatus.Completed
  const isSelfCustodial = activeWallet.accountType === AccountType.SelfCustodial

  const btcBalance = useMemo(() => {
    const btcWallet = activeWallet.wallets.find(
      (w) => w.walletCurrency === WalletCurrency.Btc,
    )
    return btcWallet?.balance.amount ?? 0
  }, [activeWallet.wallets])

  const isDismissedRecently =
    dismissedAt !== null && Date.now() - dismissedAt < DISMISSAL_COOLDOWN_MS

  const shouldShowModal =
    !isBackedUp && isSelfCustodial && loaded && btcBalance >= backupNudgeModalThreshold

  const shouldShowBanner =
    !isBackedUp &&
    isSelfCustodial &&
    loaded &&
    btcBalance >= backupNudgeBannerThreshold &&
    !shouldShowModal &&
    !isDismissedRecently

  const shouldShowSettingsBanner = !isBackedUp && isSelfCustodial && loaded

  return {
    shouldShowBanner,
    shouldShowModal,
    shouldShowSettingsBanner,
    dismissBanner,
  }
}
