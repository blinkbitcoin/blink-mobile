import { createContext, useContext, PropsWithChildren } from "react"
import * as React from "react"

import { recordAppError } from "@app/utils/error-reporting"

import { reportError } from "@app/utils/error-logging"
import { loadJson, saveJson, saveString } from "@app/utils/storage"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

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
    recordAppError(new Error(`Quarantine write failed for key ${key}`), {
      alwaysRecord: true,
    })
  }
}

/**
 * The session token is never persisted in this AsyncStorage blob: it lives in
 * the secure key store (KeyStoreWrapper) and is hydrated into memory on load.
 * A token still present in a blob written before this split is moved to the
 * key store here, then stripped from disk on the next save.
 */
const hydrateAuthToken = async (state: PersistentState): Promise<PersistentState> => {
  const secureToken = await KeyStoreWrapper.getActiveAuthToken()
  if (secureToken) {
    return { ...state, galoyAuthToken: secureToken }
  }
  if (state.galoyAuthToken) {
    await KeyStoreWrapper.setActiveAuthToken(state.galoyAuthToken)
  }
  return state
}

export const loadPersistentState = async (): Promise<PersistentState> => {
  const data = await loadJson(PERSISTENT_STATE_KEY)
  const result = await migratePersistentState(data)

  switch (result.status) {
    case MigrationStatus.Ok:
      return hydrateAuthToken(result.state)
    case MigrationStatus.NoData:
      return hydrateAuthToken(defaultPersistentState)
    case MigrationStatus.Failed:
      recordAppError(result.error, { alwaysRecord: true })
      await quarantineRawState(result.rawData)
      return hydrateAuthToken(defaultPersistentState)
  }
}

const savePersistentState = async (state: PersistentState): Promise<void> => {
  try {
    // galoyAuthToken stays in memory only — the plaintext copy on disk is
    // always blank; the real token is in the secure key store.
    await saveJson(PERSISTENT_STATE_KEY, { ...state, galoyAuthToken: "" })
  } catch (err) {
    // Storage failures are crash-adjacent: never downgrade on message wording.
    reportError("Persistent state save", err, { alwaysRecord: true })
  }
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
