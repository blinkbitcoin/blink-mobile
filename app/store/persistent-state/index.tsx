import { createContext, useContext, PropsWithChildren } from "react"
import * as React from "react"

import { loadJson, saveJson } from "@app/utils/storage"

import {
  defaultPersistentState,
  migrateAndGetPersistentState,
  PersistentState,
} from "./state-migrations"

const PERSISTENT_STATE_KEY = "persistentState"

const loadPersistentState = async (): Promise<PersistentState> => {
  const data = await loadJson(PERSISTENT_STATE_KEY)
  return migrateAndGetPersistentState(data)
}

const savePersistentState = async (state: PersistentState) => {
  return saveJson(PERSISTENT_STATE_KEY, state)
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
  // Start with default state immediately to avoid blocking render
  // This improves startup time by 0.5-1s by not waiting for AsyncStorage
  const [persistentState, setPersistentState] = React.useState<PersistentState>(
    defaultPersistentState,
  )
  const [isLoaded, setIsLoaded] = React.useState(false)

  React.useEffect(() => {
    // Only save if state has been loaded and potentially modified
    if (isLoaded && persistentState) {
      savePersistentState(persistentState)
    }
  }, [persistentState, isLoaded])

  React.useEffect(() => {
    ;(async () => {
      // Load persisted state in background without blocking render
      const loadedState = await loadPersistentState()
      setPersistentState(loadedState)
      setIsLoaded(true)
    })()
  }, [])

  const resetState = React.useCallback(() => {
    setPersistentState(defaultPersistentState)
  }, [])

  // Render immediately with default state instead of blocking
  return (
    <PersistentStateContext.Provider
      value={{ persistentState, updateState: setPersistentState, resetState }}
    >
      {children}
    </PersistentStateContext.Provider>
  )
}

export const usePersistentStateContext = (() =>
  useContext(PersistentStateContext)) as () => PersistentStateContextType
