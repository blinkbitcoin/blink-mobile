import { useCallback, useEffect, useMemo, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"

import { useTotalBalance } from "@app/components/balance-header/use-total-balance"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useIsSelfCustodialAccount } from "@app/hooks/use-is-self-custodial-account"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"

import { BackupStatus, useBackupState } from "../providers/backup-state"

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
  const isSelfCustodial = useIsSelfCustodialAccount()
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

    // The two reads race across an account switch: nothing orders the previous
    // account's reply before the current one's, and applying a stale reply would
    // decide this account's nudges from the other account's dismissals.
    let cancelled = false
    const bannerKey = bannerDismissalKeyFor(activeSelfCustodialAccountId)
    const modalKey = modalDismissalKeyFor(activeSelfCustodialAccountId)

    setLoaded(false)
    AsyncStorage.multiGet([bannerKey, modalKey])
      .then((entries) => {
        if (cancelled) return
        // Look the values up by key: Android returns them in SQLite row order
        // with the not-found keys appended, not in the order we asked for.
        const byKey = new Map(entries)
        setBannerDismissedAt(parseDismissedAt(byKey.get(bannerKey)))
        setModalDismissedAt(parseDismissedAt(byKey.get(modalKey)))
        setLoaded(true)
      })
      .catch((err) => {
        reportError("Nudge dismiss read", err)
        if (cancelled) return
        // Fail open: an unreadable storage must not silence a security nudge.
        setBannerDismissedAt(null)
        setModalDismissedAt(null)
        setLoaded(true)
      })

    return () => {
      cancelled = true
    }
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

  /** The total counts held money whatever the region gate says, which is what this
   *  nudge needs: an unbacked stable-token holding is exactly as lost as an unbacked
   *  BTC one if the device goes. */
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

  // Once the modal is dismissed the banner takes over, so the user keeps a
  // visible warning without a prompt that blocks the wallet - unless they also
  // dismissed the banner inside its own cooldown, in which case both stay quiet
  // and `shouldShowSettingsBanner` below is the warning that always remains.
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
