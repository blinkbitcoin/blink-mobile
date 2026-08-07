import { useCallback } from "react"

import { useAppConfig } from "@app/hooks/use-app-config"
import useLogout from "@app/hooks/use-logout"
import { usePersistentStateContext } from "@app/store/persistent-state"

type DiscardCustodialSessionArgs = {
  /** False once the account was closed: `markAccountForDeletion` deletes the Kratos identity
   *  and every session with it, so revoking would fire a doomed mutation and report a failure
   *  on every successful migration. The local cleanup is the same either way. */
  isSessionAlive: boolean
}

/**
 * Removes the active custodial session from this device (its stored profile and the live token) so
 * the migrated account leaves the registry, without touching other sessions or self-custodial ones.
 * When the session is still alive the logout also revokes it server-side and detaches the push
 * device token; a failed revocation never blocks the migration (the mutation is raced against a
 * short timeout and errors are only recorded). A closed account needs neither: it is left
 * `Closed` server-side, so it has nothing left to notify this device about.
 */
export const useDiscardCustodialSession = () => {
  const {
    persistentState: { galoyAuthToken },
  } = usePersistentStateContext()
  const { saveToken } = useAppConfig()
  const { logout } = useLogout()

  const discardCustodialSession = useCallback(
    async ({ isSessionAlive }: DiscardCustodialSessionArgs): Promise<void> => {
      if (galoyAuthToken) {
        await logout({
          stateToDefault: false,
          token: galoyAuthToken,
          isValidToken: isSessionAlive,
        })
      }
      await saveToken("")
    },
    [galoyAuthToken, logout, saveToken],
  )

  return { discardCustodialSession }
}
