import { createContext, useContext, PropsWithChildren } from "react"
import * as React from "react"

import { loadJson, saveJson } from "@app/utils/storage"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import {
  defaultPersistentState,
  migrateAndGetLocalStorageState,
  PersistentState,
} from "./state-migrations"

const PERSISTENT_STATE_KEY = "persistentState"

const loadPersistentState = async (): Promise<PersistentState> => {
  const data = await loadJson(PERSISTENT_STATE_KEY)
  const localStorageState = await migrateAndGetLocalStorageState(data)
  const secureStorageState = await KeyStoreWrapper.getSecureStorageState()
  return { ...localStorageState, ...secureStorageState }
}

const savePersistentState = async (state: PersistentState) => {
  const { galoyAuthToken, ...data } = state
  saveJson(PERSISTENT_STATE_KEY, data)
  KeyStoreWrapper.setSecureStorageState({ galoyAuthToken })
}

// TODO: should not be exported
export type PersistentStateContextType = {
  persistentState: PersistentState
  updateState: (
    update: (state: PersistentState | undefined) => PersistentState | undefined,
  ) => void
  resetState: () => void
}

// TODO: should not be exported
export const PersistentStateContext = createContext<PersistentStateContextType | null>(
  null,
)

export const PersistentStateProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [persistentState, setPersistentState] = React.useState<
    PersistentState | undefined
  >(undefined)

  React.useEffect(() => {
    if (persistentState) {
      savePersistentState(persistentState)
    }
  }, [persistentState])

  React.useEffect(() => {
    ;(async () => {
      const persistentState = await loadPersistentState()
      setPersistentState(persistentState)
    })()
  }, [])

  const resetState = React.useCallback(() => {
    setPersistentState(defaultPersistentState)
  }, [])

  return persistentState ? (
    <PersistentStateContext.Provider
      value={{ persistentState, updateState: setPersistentState, resetState }}
    >
      {children}
    </PersistentStateContext.Provider>
  ) : null
}

export const usePersistentStateContext = (() =>
  useContext(PersistentStateContext)) as () => PersistentStateContextType
