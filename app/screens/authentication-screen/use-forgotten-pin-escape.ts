import { useCallback, useEffect, useState } from "react"
import { Alert } from "react-native"

import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useLogoutAndRoute } from "@app/hooks/use-logout-and-route"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useRemoveStoredWallets } from "@app/self-custodial/hooks/use-remove-stored-wallets"
import {
  readStoredWalletPresence,
  StoredWalletPresence,
} from "@app/self-custodial/storage/account-index"

type ForgottenPinEscape = {
  /**
   * What the lock screen's way out should be, once the device has been read. `null` while
   * the read is out, so neither button flashes before the other.
   *
   * On a device that stores a wallet, or cannot tell whether it does, a logout keeps the
   * lock and comes straight back to it, so the way out is removing the wallets. On a device
   * that stores none, a logout takes the lock with it and is the way out.
   */
  readonly escape: "removeWallets" | "logout" | null
  /** Asks first, because a wallet comes back only with its backup phrase, then removes
   *  every wallet and logs out, landing wherever that leaves the lock. */
  readonly confirmRemoveWallets: () => void
}

/**
 * The lock screens' way out for an owner who forgot the PIN. Without it, a device that
 * stores a wallet keeps its lock through every logout and has no exit short of a reinstall.
 */
export const useForgottenPinEscape = (): ForgottenPinEscape => {
  const { LL } = useI18nContext()
  const removeStoredWallets = useRemoveStoredWallets()
  const { routeAfterLogout } = useLogoutAndRoute()
  const { run } = useInFlightGuard()
  const [presence, setPresence] = useState<StoredWalletPresence | null>(null)

  useEffect(() => {
    let isCancelled = false
    readStoredWalletPresence().then((read) => {
      if (!isCancelled) setPresence(read)
    })
    return () => {
      isCancelled = true
    }
  }, [])

  const removeWalletsAndLeave = useCallback(
    () =>
      run(async () => {
        const { isEveryWalletRemoved, isAppLockKept } = await removeStoredWallets()
        if (!isEveryWalletRemoved) {
          Alert.alert(LL.AuthenticationScreen.removeWalletsFailed())
          return
        }
        routeAfterLogout(isAppLockKept)
      }),
    [run, removeStoredWallets, routeAfterLogout, LL],
  )

  const confirmRemoveWallets = useCallback(() => {
    Alert.alert(
      LL.AuthenticationScreen.removeWalletsTitle(),
      LL.AuthenticationScreen.removeWalletsBody(),
      [
        { text: LL.common.cancel(), style: "cancel" },
        {
          text: LL.AuthenticationScreen.removeWalletsConfirm(),
          style: "destructive",
          onPress: removeWalletsAndLeave,
        },
      ],
    )
  }, [LL, removeWalletsAndLeave])

  const isPresenceRead = presence !== null
  const isLockKeptByLogout = presence !== StoredWalletPresence.Absent
  const logoutEscape = isLockKeptByLogout ? "removeWallets" : "logout"
  const escape = isPresenceRead ? logoutEscape : null

  return { escape, confirmRemoveWallets }
}
