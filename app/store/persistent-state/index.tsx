import { createContext, useContext, PropsWithChildren } from "react"
import * as React from "react"

import crashlytics from "@react-native-firebase/crashlytics"

import { loadJson, saveJson, saveString } from "@app/utils/storage"

import {
  defaultPersistentState,
  migratePersistentState,
  MigrationStatus,
  PersistentState,
} from "./state-migrations"

const PERSISTENT_STATE_KEY = "persistentState"
const PERSISTENT_STATE_QUARANTINE_PREFIX = "persistentStateQuarantine"

const quarantineRawState = async (rawData: unknown): Promise<void> => {
  const key = `${PERSISTENT_STATE_QUARANTINE_PREFIX}.${Date.now()}`
  const ok = await saveString(key, JSON.stringify(rawData))
  if (!ok) {
    crashlytics().recordError(new Error(`Quarantine write failed for key ${key}`))
  }
}

export const loadPersistentState = async (): Promise<PersistentState> => {
  const data = await loadJson(PERSISTENT_STATE_KEY)
  const result = await migratePersistentState(data)

  switch (result.status) {
    case MigrationStatus.Ok:
      return result.state
    case MigrationStatus.NoData:
      return defaultPersistentState
    case MigrationStatus.Failed:
      crashlytics().recordError(result.error)
      await quarantineRawState(result.rawData)
      return defaultPersistentState
  }
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
  const [persistentState, setPersistentState] = React.useState<PersistentState | null>(
    null,
  )
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
    <PersistentStateContext.Provider value={{ persistentState, updateState, resetState }}>
      {children}
    </PersistentStateContext.Provider>
  )
}

export const usePersistentStateContext = (() =>
  useContext(PersistentStateContext)) as () => PersistentStateContextType
