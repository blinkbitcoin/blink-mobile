import { useCallback, useEffect, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"

import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"

import { useAccountRegistry } from "./use-account-registry"
import { useActiveWallet } from "./use-active-wallet"

const DISMISSED_KEY_PREFIX = "selfCustodialInfoBulletinDismissed"

const dismissedKeyFor = (accountId: string): string =>
  `${DISMISSED_KEY_PREFIX}:${accountId}`

type SelfCustodialInfoBulletinState = {
  shouldShow: boolean
  dismiss: () => void
}

type DismissalState = {
  accountId: string | null
  dismissed: boolean
}

const INITIAL_DISMISSAL: DismissalState = { accountId: null, dismissed: false }

/**
 * Controls the one-time "this is a non-custodial account" home bulletin shown to
 * self-custodial accounts. Persisted per account so it shows once and stays dismissed after
 * the user closes it or follows its link, the same way the backup-completed state is tracked.
 * The dismissal is keyed to the account it was read for, so switching accounts never flashes
 * the previous one's state.
 */
export const useSelfCustodialInfoBulletinState = (): SelfCustodialInfoBulletinState => {
  const { isReady } = useActiveWallet()
  const { activeAccount } = useAccountRegistry()
  const [dismissal, setDismissal] = useState<DismissalState>(INITIAL_DISMISSAL)

  const activeSelfCustodialAccountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  useEffect(() => {
    if (!activeSelfCustodialAccountId) {
      setDismissal(INITIAL_DISMISSAL)
      return
    }
    let mounted = true
    const accountId = activeSelfCustodialAccountId
    AsyncStorage.getItem(dismissedKeyFor(accountId)).then((raw) => {
      if (mounted) setDismissal({ accountId, dismissed: raw === "true" })
    })
    return () => {
      mounted = false
    }
  }, [activeSelfCustodialAccountId])

  const dismiss = useCallback(() => {
    if (!activeSelfCustodialAccountId) return
    setDismissal({ accountId: activeSelfCustodialAccountId, dismissed: true })
    AsyncStorage.setItem(dismissedKeyFor(activeSelfCustodialAccountId), "true").catch(
      (err) => reportError("Self-custodial info bulletin dismiss write", err),
    )
  }, [activeSelfCustodialAccountId])

  const shouldShow =
    Boolean(activeSelfCustodialAccountId) &&
    isReady &&
    dismissal.accountId === activeSelfCustodialAccountId &&
    !dismissal.dismissed

  return { shouldShow, dismiss }
}
