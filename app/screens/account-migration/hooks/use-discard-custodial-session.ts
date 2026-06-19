import { useCallback } from "react"

import { useAppConfig } from "@app/hooks/use-app-config"
import { usePersistentStateContext } from "@app/store/persistent-state"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

/**
 * Removes the active custodial session from this device (its stored profile and the live token) so
 * the migrated account leaves the registry, without touching other sessions or self-custodial ones.
 */
export const useDiscardCustodialSession = () => {
  const {
    persistentState: { galoyAuthToken },
  } = usePersistentStateContext()
  const { saveToken } = useAppConfig()

  const discardCustodialSession = useCallback(async (): Promise<void> => {
    if (galoyAuthToken) {
      await KeyStoreWrapper.removeSessionProfileByToken(galoyAuthToken)
    }
    await saveToken("")
  }, [galoyAuthToken, saveToken])

  return { discardCustodialSession }
}
