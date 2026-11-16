import { useCallback, useEffect, useRef } from "react"
import { useNavigation } from "@react-navigation/native"
import { type NativeStackNavigationProp } from "@react-navigation/native-stack"

import { CONTACT_EMAIL_ADDRESS } from "@app/config"
import { useLogoutAndRoute } from "@app/hooks/use-logout-and-route"
import { useI18nContext } from "@app/i18n/i18n-react"
import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  type DeleteAccountOutcome,
  useDeleteAccount,
} from "@app/self-custodial/hooks/use-delete-account"
import { toastShow } from "@app/utils/toast"

import { useAccountDeleteContext } from "../account/account-delete-context"

import { navigateAfterAccountDelete } from "./navigate-after-account-delete"

type PendingRemoval = { accountId: string; identifier: string }

/** The confirm modal closes in 300 ms (react-native-modal's default `animationOutTiming`,
 *  which CustomModal keeps); past this its hide is not coming. */
export const REMOVAL_HIDE_FALLBACK_MS = 1_000

type UseAccountRemovalResult = {
  /** Called on confirm: only records the removal, the confirm modal is still closing. */
  requestRemoval: (accountId: string, identifier: string) => void
  /** Wire to the confirm modal's `onClose`. */
  cancelRemoval: () => void
  /** Wire to the confirm modal's `onModalHide`. */
  runPendingRemoval: () => Promise<void>
}

/**
 * The delete hook switches the active account before it wipes the removed one, so the
 * screen behind it starts describing the next account while the removal is still running.
 * The removal therefore waits for the confirm modal to finish closing, runs under an opaque
 * lock that names the account being removed, and says which account went once it lands,
 * or that it could not be removed.
 */
export const useAccountRemoval = (): UseAccountRemovalResult => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()
  const { deleteWallet } = useDeleteAccount()
  const { routeAfterLogout } = useLogoutAndRoute()
  const { setAccountIsBeingDeleted, leaveWhileDeleting } = useAccountDeleteContext()

  const pendingRemoval = useRef<PendingRemoval | null>(null)
  const hideFallback = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runPendingRemovalRef = useRef<() => Promise<void>>(async () => {})

  const clearHideFallback = useCallback(() => {
    if (hideFallback.current) clearTimeout(hideFallback.current)
    hideFallback.current = null
  }, [])

  /** The hide is what normally starts the removal, but it can be skipped (on iOS among
   *  others), and a confirmed removal must not then silently never run. The fallback runs
   *  it once the close animation has had more than enough time; whichever comes first
   *  takes the pending removal, so it runs once. */
  const requestRemoval = useCallback(
    (accountId: string, identifier: string) => {
      pendingRemoval.current = { accountId, identifier }
      clearHideFallback()
      hideFallback.current = setTimeout(() => {
        hideFallback.current = null
        runPendingRemovalRef.current()
      }, REMOVAL_HIDE_FALLBACK_MS)
    },
    [clearHideFallback],
  )

  /** Also covers a hide that never reported: a confirmed removal left waiting would run on
   *  the next Cancel's hide although the user just declined. */
  const cancelRemoval = useCallback(() => {
    clearHideFallback()
    pendingRemoval.current = null
  }, [clearHideFallback])

  /** Off the screen, nothing is left to run the removal under, so the fallback goes too. */
  useEffect(() => clearHideFallback, [clearHideFallback])

  /** A failed removal of the last account lands on Get started, which has no way back
   *  to the account, so offering a retry there would promise something the app can't do. */
  const failureMessage = useCallback(
    (identifier: string, outcome: DeleteAccountOutcome) =>
      outcome === "logged-out" || outcome === "logged-out-locked"
        ? LL.SelfCustodialDelete.removalIncomplete({
            identifier,
            email: CONTACT_EMAIL_ADDRESS,
          })
        : LL.SelfCustodialDelete.removalFailed({ identifier }),
    [LL],
  )

  const runPendingRemoval = useCallback(async () => {
    clearHideFallback()
    const removal = pendingRemoval.current
    if (!removal) return
    pendingRemoval.current = null

    const { identifier } = removal
    setAccountIsBeingDeleted(true, identifier)
    const { removed, outcome } = await deleteWallet(removal.accountId)

    /** A failure that switched nothing leaves this screen accurate, so the user stays and
     *  can retry. Otherwise the active account has already moved, even when the removal
     *  failed, so the screen is left the way a removal leaves it. The lock is not dropped
     *  first: that would flash the already-switched screen during the transition. */
    if (!removed && outcome === "remained") {
      setAccountIsBeingDeleted(false)
    } else {
      leaveWhileDeleting(() =>
        navigateAfterAccountDelete(navigation, routeAfterLogout, outcome),
      )
    }

    toastShow({
      type: removed ? "success" : "error",
      message: removed
        ? LL.ProfileScreen.removedAccount({ identifier })
        : failureMessage(identifier, outcome),
      LL,
      privateValues: [identifier],
    })
  }, [
    clearHideFallback,
    deleteWallet,
    setAccountIsBeingDeleted,
    leaveWhileDeleting,
    navigation,
    routeAfterLogout,
    failureMessage,
    LL,
  ])

  /** The fallback fires a render or more after it was armed, so it calls the latest
   *  removal rather than the one it closed over. */
  runPendingRemovalRef.current = runPendingRemoval

  return { requestRemoval, cancelRemoval, runPendingRemoval }
}
