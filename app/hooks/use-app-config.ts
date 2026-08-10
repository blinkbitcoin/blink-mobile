import { useCallback, useMemo } from "react"

import { GaloyInstance, resolveGaloyInstanceOrDefault } from "@app/config"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

// The session token is persisted only in the secure key store; the persistent
// state copy is in-memory (its on-disk blob is written with the token stripped).
// A rejected key-store write leaves the token memory-only — the session
// evaporates at next launch — so surface it instead of resolving silently.
const persistToken = async (token: string): Promise<void> => {
  const persisted = token
    ? await KeyStoreWrapper.setActiveAuthToken(token)
    : await KeyStoreWrapper.removeActiveAuthToken()
  if (!persisted) {
    reportError(
      "persist auth token",
      new Error("secure key store rejected the auth token update"),
      { alwaysRecord: true },
    )
  }
}

export const useAppConfig = () => {
  const { persistentState, updateState } = usePersistentStateContext()

  const appConfig = useMemo(
    () => ({
      token: persistentState.galoyAuthToken,
      galoyInstance: resolveGaloyInstanceOrDefault(persistentState.galoyInstance),
    }),
    [persistentState.galoyAuthToken, persistentState.galoyInstance],
  )

  const setGaloyInstance = useCallback(
    (newInstance: GaloyInstance) => {
      updateState((state) => {
        if (state)
          return {
            ...state,
            galoyInstance: newInstance,
          }
        return undefined
      })
    },
    [updateState],
  )

  const saveToken = useCallback(
    async (token: string) => {
      await persistToken(token)
      updateState((state) => {
        if (state)
          return {
            ...state,
            galoyAuthToken: token,
          }
        return undefined
      })
    },
    [updateState],
  )

  const saveTokenAndInstance = useCallback(
    async ({ token, instance }: { token: string; instance: GaloyInstance }) => {
      await persistToken(token)
      updateState((state) => {
        if (state)
          return {
            ...state,
            galoyInstance: instance,
            galoyAuthToken: token,
          }
        return undefined
      })
    },
    [updateState],
  )

  return {
    appConfig,
    setGaloyInstance,
    saveToken,
    saveTokenAndInstance,
  }
}
