import { useCallback } from "react"

import { useAppConfig } from "@app/hooks/use-app-config"
import useLogout from "@app/hooks/use-logout"
import { usePersistentStateContext } from "@app/store/persistent-state"

/**
 * Removes the active custodial session from this device (its stored profile and the live token) so
 * the migrated account leaves the registry, without touching other sessions or self-custodial ones.
 * The logout also revokes the session server-side and detaches the push device token, so the
 * closed custodial account stops notifying this device; a failed revocation never blocks the
 * migration (the mutation is raced against a short timeout and errors are only recorded).
 */
export const useDiscardCustodialSession = () => {
  const {
    persistentState: { galoyAuthToken },
  } = usePersistentStateContext()
  const { saveToken } = useAppConfig()
  const { logout } = useLogout()

  const discardCustodialSession = useCallback(async (): Promise<void> => {
    if (galoyAuthToken) {
      await logout({ stateToDefault: false, token: galoyAuthToken })
    }
    await saveToken("")
  }, [galoyAuthToken, logout, saveToken])

  return { discardCustodialSession }
}
