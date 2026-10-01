import { useCallback, useRef } from "react"

import { useNavigation } from "@react-navigation/native"
import { type NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { useDeleteAccount } from "@app/self-custodial/hooks/use-delete-account"
import { toastShow } from "@app/utils/toast"

import { useAccountDeleteContext } from "../account/account-delete-context"

import { navigateAfterAccountDelete } from "./navigate-after-account-delete"

type PendingRemoval = { accountId: string; identifier: string }

type UseAccountRemovalResult = {
  /** Called on confirm: only records the removal, the confirm modal is still closing. */
  requestRemoval: (accountId: string, identifier: string) => void
  /** Wire to the confirm modal's `onModalHide`. */
  runPendingRemoval: () => Promise<void>
}

/**
 * The delete hook switches the active account before it wipes the removed one, so the
 * screen behind it starts describing the next account while the removal is still running.
 * The removal therefore waits for the confirm modal to finish closing, runs under an opaque
 * lock that names the account being removed, and says which account went once it lands.
 */
export const useAccountRemoval = (): UseAccountRemovalResult => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()
  const { deleteWallet } = useDeleteAccount()
  const { setAccountIsBeingDeleted } = useAccountDeleteContext()

  const pendingRemoval = useRef<PendingRemoval | null>(null)

  const requestRemoval = useCallback((accountId: string, identifier: string) => {
    pendingRemoval.current = { accountId, identifier }
  }, [])

  const runPendingRemoval = useCallback(async () => {
    const removal = pendingRemoval.current
    if (!removal) return
    pendingRemoval.current = null

    setAccountIsBeingDeleted(true, removal.identifier)
    const outcome = await deleteWallet(removal.accountId)
    if (!outcome) {
      setAccountIsBeingDeleted(false)
      return
    }

    /** No release on success: every outcome navigates this screen away, and dropping the
     *  lock first would flash the already-switched screen during the transition. */
    navigateAfterAccountDelete(navigation, outcome)
    toastShow({
      type: "success",
      message: LL.ProfileScreen.removedAccount({ identifier: removal.identifier }),
      LL,
    })
  }, [deleteWallet, setAccountIsBeingDeleted, navigation, LL])

  return { requestRemoval, runPendingRemoval }
}
