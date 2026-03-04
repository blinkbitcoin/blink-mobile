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
  const [persistentState, setPersistentState] =
    React.useState<PersistentState | null>(null)
  const hasModified = React.useRef(false)

  React.useEffect(() => {
    if (hasModified.current && persistentState) {
      savePersistentState(persistentState)
    }
  }, [persistentState])

  React.useEffect(() => {
    ;(async () => {
      const loadedState = await loadPersistentState()
      setPersistentState(loadedState)
    })()
  }, [])

  const updateState = React.useCallback(
    (update: (state: PersistentState | undefined) => PersistentState | undefined) => {
      hasModified.current = true
      setPersistentState((prev) => update(prev ?? undefined) ?? prev)
    },
    [],
  )

  const resetState = React.useCallback(() => {
    hasModified.current = true
    setPersistentState(defaultPersistentState)
  }, [])

  if (!persistentState) return null

  return (
    <PersistentStateContext.Provider
      value={{ persistentState, updateState, resetState }}
    >
      {children}
    </PersistentStateContext.Provider>
  )
}

export const usePersistentStateContext = (() =>
  useContext(PersistentStateContext)) as () => PersistentStateContextType
