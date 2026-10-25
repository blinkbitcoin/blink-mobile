import { useCallback } from "react"

import {
  SettingsScreenDocument,
  useSettingsScreenLazyQuery,
  useSettingsScreenQuery,
  useUserEmailDeleteMutation,
} from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/transport-error"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"
import { LoginMethodRefusal } from "@app/types/two-factor-enforcement"

/**
 * Removes the account's email right before it is registered again, which the server
 * refuses while an address is on the account; removing it needs no code. Hands back the
 * server's refusal, if any, and throws on a request that never answers and did not land.
 */
export const useEmailRemoval = () => {
  const { updateCurrentProfile } = useSaveSessionProfile()
  const [emailDelete] = useUserEmailDeleteMutation()
  const [readAccount] = useSettingsScreenLazyQuery({ fetchPolicy: "network-only" })
  /** The account the removal is for, as the settings read it. */
  const { data: accountData } = useSettingsScreenQuery({ fetchPolicy: "cache-only" })
  const accountId = accountData?.me?.id

  /** Whether the email is gone on the server, read from the network, on the account the
   *  removal was sent for: a session switched meanwhile reads another one. A read that
   *  fails is no proof it is. */
  const isRemovedOnServer = useCallback(
    async (sentFor: string | undefined): Promise<boolean> => {
      try {
        const { data, error } = await readAccount()
        if (error) return false
        const me = data?.me
        if (!me) return false
        const isAccountSentFor = me.id === sentFor
        if (!isAccountSentFor) return false
        return !me.email?.address
      } catch {
        return false
      }
    },
    [readAccount],
  )

  /** A removal whose answer was lost may have landed, and sent again it would be
   *  refused, as there is nothing left to remove: the account is read instead, after a
   *  lost answer and after a refusal alike, and an email gone counts as removed. */
  const remove = useCallback(async (): Promise<LoginMethodRefusal | undefined> => {
    const sentFor = accountId
    try {
      const res = await emailDelete({ refetchQueries: [SettingsScreenDocument] })
      const refusal = res.data?.userEmailDelete.errors[0]
      const isRefused = refusal !== undefined
      const isRemovedAnyway = isRefused && (await isRemovedOnServer(sentFor))
      if (isRefused && !isRemovedAnyway) return refusal
    } catch (err) {
      const isAnswerLost = isNetworkFailure(err)
      const isRemoved = isAnswerLost && (await isRemovedOnServer(sentFor))
      if (!isRemoved) throw err
    }
    await updateCurrentProfile()
    return undefined
  }, [accountId, emailDelete, isRemovedOnServer, updateCurrentProfile])

  return { remove }
}
