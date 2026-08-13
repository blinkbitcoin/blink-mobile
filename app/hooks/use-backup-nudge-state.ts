import { useCallback, useEffect, useMemo, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"

import { useTotalBalance } from "@app/components/balance-header/use-total-balance"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { BackupStatus, useBackupState } from "@app/self-custodial/providers/backup-state"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"

import { useAccountRegistry } from "./use-account-registry"
import { useActiveWallet } from "./use-active-wallet"

const BANNER_DISMISSAL_COOLDOWN_MS = 24 * 60 * 60 * 1000
const BANNER_DISMISSAL_KEY_PREFIX = "backupNudgeDismissedAt"
const MODAL_DISMISSAL_KEY_PREFIX = "backupNudgeModalDismissedAt"

const bannerDismissalKeyFor = (accountId: string): string =>
  `${BANNER_DISMISSAL_KEY_PREFIX}:${accountId}`

const modalDismissalKeyFor = (accountId: string): string =>
  `${MODAL_DISMISSAL_KEY_PREFIX}:${accountId}`

const parseDismissedAt = (raw: string | null | undefined): number | null =>
  raw ? Number(raw) : null

const persistDismissal = (key: string, at: number): void => {
  AsyncStorage.setItem(key, String(at)).catch((err) => {
    reportError("Nudge dismiss write", err)
  })
}

type BackupNudgeState = {
  shouldShowBanner: boolean
  shouldShowModal: boolean
  shouldShowSettingsBanner: boolean
  dismissBanner: () => void
  dismissModal: () => void
}

export const useBackupNudgeState = (): BackupNudgeState => {
  const { backupState } = useBackupState()
  const activeWallet = useActiveWallet()
  const { activeAccount } = useAccountRegistry()
  const {
    backupNudgeBannerThreshold,
    backupNudgeModalThreshold,
    backupNudgeModalCooldownMs,
  } = useRemoteConfig()
  const [bannerDismissedAt, setBannerDismissedAt] = useState<number | null>(null)
  const [modalDismissedAt, setModalDismissedAt] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  const activeSelfCustodialAccountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  useEffect(() => {
    if (!activeSelfCustodialAccountId) {
      setBannerDismissedAt(null)
      setModalDismissedAt(null)
      setLoaded(true)
      return
    }
    setLoaded(false)
    AsyncStorage.multiGet([
      bannerDismissalKeyFor(activeSelfCustodialAccountId),
      modalDismissalKeyFor(activeSelfCustodialAccountId),
    ]).then((entries) => {
      const [bannerEntry, modalEntry] = entries
      setBannerDismissedAt(parseDismissedAt(bannerEntry?.[1]))
      setModalDismissedAt(parseDismissedAt(modalEntry?.[1]))
      setLoaded(true)
    })
  }, [activeSelfCustodialAccountId])

  const dismissBanner = useCallback(() => {
    if (!activeSelfCustodialAccountId) return
    const now = Date.now()
    setBannerDismissedAt(now)
    persistDismissal(bannerDismissalKeyFor(activeSelfCustodialAccountId), now)
  }, [activeSelfCustodialAccountId])

  const dismissModal = useCallback(() => {
    if (!activeSelfCustodialAccountId) return
    const now = Date.now()
    setModalDismissedAt(now)
    persistDismissal(modalDismissalKeyFor(activeSelfCustodialAccountId), now)
  }, [activeSelfCustodialAccountId])

  const isBackedUp = backupState.status === BackupStatus.Completed
  const isSelfCustodial = activeWallet.accountType === AccountType.SelfCustodial
  const isWalletReady = activeWallet.isReady

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

  const isBannerDismissedRecently =
    bannerDismissedAt !== null &&
    Date.now() - bannerDismissedAt < BANNER_DISMISSAL_COOLDOWN_MS

  const isModalDismissedRecently =
    modalDismissedAt !== null &&
    Date.now() - modalDismissedAt < backupNudgeModalCooldownMs

  const shouldShowModal =
    !isBackedUp &&
    isSelfCustodial &&
    isWalletReady &&
    loaded &&
    satsBalance >= backupNudgeModalThreshold &&
    !isModalDismissedRecently

  // Once the modal is dismissed the banner takes over: the user keeps a visible
  // warning without a prompt that blocks the wallet.
  const shouldShowBanner =
    !isBackedUp &&
    isSelfCustodial &&
    isWalletReady &&
    loaded &&
    satsBalance >= backupNudgeBannerThreshold &&
    !shouldShowModal &&
    !isBannerDismissedRecently

  const shouldShowSettingsBanner = !isBackedUp && isSelfCustodial

  return {
    shouldShowBanner,
    shouldShowModal,
    shouldShowSettingsBanner,
    dismissBanner,
    dismissModal,
  }
}
