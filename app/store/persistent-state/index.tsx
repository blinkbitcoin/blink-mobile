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

// The raw blob can predate the token/keystore split and still carry a
// plaintext galoyAuthToken — never write that copy back to disk.
const sanitizeForQuarantine = (rawData: unknown): unknown =>
  rawData && typeof rawData === "object" && "galoyAuthToken" in rawData
    ? { ...rawData, galoyAuthToken: "" }
    : rawData

const quarantineRawState = async (rawData: unknown): Promise<void> => {
  const key = `${PERSISTENT_STATE_QUARANTINE_PREFIX}.${Date.now()}`
  const ok = await saveString(key, JSON.stringify(sanitizeForQuarantine(rawData)))
  if (!ok) {
    recordAppError(new Error(`Quarantine write failed for key ${key}`), {
      alwaysRecord: true,
    })
  }
}

/**
 * The session token is never persisted in the AsyncStorage blob: it lives in
 * the secure key store (KeyStoreWrapper) and is attached to the in-memory
 * state here, on the Ok path only. NoData is a fresh install (the iOS
 * keychain can outlive the app, so "no blob" must not mean "resume the old
 * session"), and Failed is a deliberate clean slate — neither should come up
 * authenticated. A token still present in a pre-split blob is moved to the
 * key store, then stripped from disk on the next save.
 */
const resolveAuthToken = async (state: PersistentState): Promise<PersistentState> => {
  const secureToken = await KeyStoreWrapper.getActiveAuthToken()
  if (secureToken) {
    return { ...state, galoyAuthToken: secureToken }
  }
  if (state.galoyAuthToken) {
    const moved = await KeyStoreWrapper.setActiveAuthToken(state.galoyAuthToken)
    if (!moved) {
      // The token now exists only in memory; the next save strips the blob
      // copy, so the session ends at next launch. Make that visible.
      recordAppError(new Error("Failed to move legacy auth token to the key store"), {
        alwaysRecord: true,
      })
    }
  }
  return state
}

export const loadPersistentState = async (): Promise<PersistentState> => {
  const data = await loadJson(PERSISTENT_STATE_KEY)
  const result = await migratePersistentState(data)

  switch (result.status) {
    case MigrationStatus.Ok:
      return resolveAuthToken(result.state)
    case MigrationStatus.NoData:
      return defaultPersistentState
    case MigrationStatus.Failed:
      recordAppError(result.error, { alwaysRecord: true })
      await quarantineRawState(result.rawData)
      return defaultPersistentState
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
