import { createContext, useContext, PropsWithChildren } from "react"
import * as React from "react"

import { recordAppError } from "@app/utils/error-reporting"

import { reportError } from "@app/utils/error-logging"
import {
  getAllKeys,
  loadJson,
  loadString,
  saveJson,
  saveString,
} from "@app/utils/storage"
import KeyStoreWrapper, { type GaloyAuthTokenKey } from "@app/utils/storage/secureStorage"

import {
  defaultPersistentState,
  migratePersistentState,
  MigrationStatus,
  PersistentState,
} from "./state-migrations"

const PERSISTENT_STATE_KEY = "persistentState"
const PERSISTENT_STATE_QUARANTINE_PREFIX = "persistentStateQuarantine"

const TOKEN_REDACTED = "[REDACTED]"

// One name, three roles: the blob field, the duck-type checks below, and the
// keychain slot. The type annotation pins this literal to secureStorage's
// GALOY_AUTH_TOKEN_KEY at compile time (a mismatch is a tsc error).
const GALOY_AUTH_TOKEN_KEY: GaloyAuthTokenKey = "galoyAuthToken"

const redactToken = (rawData: unknown): unknown => {
  if (rawData && typeof rawData === "object" && GALOY_AUTH_TOKEN_KEY in rawData) {
    return { ...rawData, [GALOY_AUTH_TOKEN_KEY]: TOKEN_REDACTED }
  }
  return rawData
}

const quarantineRawState = async (rawData: unknown): Promise<void> => {
  const key = `${PERSISTENT_STATE_QUARANTINE_PREFIX}.${Date.now()}`
  const ok = await saveString(key, JSON.stringify(redactToken(rawData)))
  if (!ok) {
    recordAppError(new Error(`Quarantine write failed for key ${key}`), {
      alwaysRecord: true,
    })
  }
}

// Deliberately NOT under the `${PERSISTENT_STATE_QUARANTINE_PREFIX}.` prefix,
// or the sweep would iterate its own marker.
const QUARANTINE_SCRUB_DONE_KEY = "persistentStateQuarantineScrubDone"

// Quarantine copies written before tokens moved to the keychain still hold the
// raw credential; rewrite them redacted.
const scrubQuarantinedTokens = async (): Promise<void> => {
  try {
    // One clean sweep is permanent: quarantine copies written after the token
    // moved to the keychain are already redacted at write time.
    if (await loadString(QUARANTINE_SCRUB_DONE_KEY)) return
    const keys = await getAllKeys()
    const quarantineKeys = keys.filter((key) =>
      key.startsWith(`${PERSISTENT_STATE_QUARANTINE_PREFIX}.`),
    )
    let allClean = true
    for (const key of quarantineKeys) {
      // Per-entry isolation: one corrupt entry must not end the sweep early —
      // later keys may still hold raw tokens.
      try {
        const raw = await loadString(key)
        const parsed = raw ? JSON.parse(raw) : null
        if (
          parsed &&
          typeof parsed === "object" &&
          GALOY_AUTH_TOKEN_KEY in parsed &&
          parsed[GALOY_AUTH_TOKEN_KEY] &&
          parsed[GALOY_AUTH_TOKEN_KEY] !== TOKEN_REDACTED
        ) {
          const ok = await saveString(key, JSON.stringify(redactToken(parsed)))
          if (!ok) {
            allClean = false
            recordAppError(new Error(`Quarantine redaction write failed for ${key}`), {
              alwaysRecord: true,
            })
          }
        }
      } catch (err) {
        allClean = false
        recordAppError(
          err instanceof Error ? err : new Error(`Quarantine entry unreadable: ${key}`),
          { alwaysRecord: true },
        )
      }
    }
    if (allClean) {
      await saveString(QUARANTINE_SCRUB_DONE_KEY, "1")
    }
  } catch (err) {
    recordAppError(
      err instanceof Error ? err : new Error("Quarantine token scrub failed"),
      { alwaysRecord: true },
    )
  }
}

type PersistentStateBlob = Omit<PersistentState, "galoyAuthToken"> & {
  // Structural typing would let a full PersistentState satisfy a plain Omit;
  // `never` turns passing the token into a compile error.
  galoyAuthToken?: never
}

// The ONLY writer of the persisted blob: the token must never reach plaintext
// storage again, and this signature makes that a compile-time guarantee.
const savePersistentStateBlob = (blob: PersistentStateBlob): Promise<void> =>
  saveJson(PERSISTENT_STATE_KEY, blob)

type LoadedPersistentState = {
  state: PersistentState
  // What the keychain durably holds after load. The provider seeds its
  // dirty-check ref from this, so a failed adoption ("") makes the first
  // save retry the keychain write instead of skipping it.
  persistedToken: string
}

export const loadPersistentState = async (): Promise<LoadedPersistentState> => {
  // Fire-and-forget: quarantine hygiene must never delay app boot.
  scrubQuarantinedTokens().catch(() => {})
  const data = await loadJson(PERSISTENT_STATE_KEY)
  const result = await migratePersistentState(data)

  switch (result.status) {
    case MigrationStatus.Ok: {
      const keychainToken = await KeyStoreWrapper.getActiveToken()
      // Blobs written before the token moved to the keychain still carry it;
      // post-scrub blobs don't, and migrations just spread the field through.
      const blobToken = result.state.galoyAuthToken ?? ""
      // The keychain is the source of truth once populated; the blob copy is
      // only adopted while the keychain slot is empty.
      let adopted = Boolean(keychainToken)
      if (blobToken) {
        if (!adopted) {
          adopted = await KeyStoreWrapper.setActiveToken(blobToken)
        }
        if (adopted) {
          const { galoyAuthToken: _, ...scrubbed } = result.state
          try {
            await savePersistentStateBlob(scrubbed)
          } catch (err) {
            reportError("Persistent state scrub", err, { alwaysRecord: true })
          }
        } else {
          // Don't scrub: the plaintext blob is the only surviving copy.
          recordAppError(new Error("Active token keychain adoption failed"), {
            alwaysRecord: true,
          })
        }
      }
      return {
        state: { ...result.state, galoyAuthToken: keychainToken || blobToken },
        persistedToken: keychainToken || (adopted ? blobToken : ""),
      }
    }
    case MigrationStatus.NoData: {
      // Genuinely a fresh install (unrecognized schemas are Failed). This
      // branch owns only the trigger and the reporting — WHICH credentials
      // survive uninstall and must be wiped is secureStorage's knowledge.
      // The branch re-runs on every boot until the first blob write, so a
      // failed wipe also retries across boots.
      await KeyStoreWrapper.clearUninstallSurvivingCredentials((what) => {
        recordAppError(new Error(`Reinstall keychain cleanup failed: ${what}`), {
          alwaysRecord: true,
        })
      })
      return { state: defaultPersistentState, persistedToken: "" }
    }
    case MigrationStatus.Failed: {
      recordAppError(result.error, { alwaysRecord: true })
      await quarantineRawState(result.rawData)
      // The credential lives in the keychain and is unaffected by blob
      // corruption: losing settings must not cost the session.
      const keychainToken = await KeyStoreWrapper.getActiveToken()
      return {
        state: { ...defaultPersistentState, galoyAuthToken: keychainToken },
        persistedToken: keychainToken,
      }
    }
  }
}

const savePersistentState = async (
  state: PersistentState,
  lastPersistedTokenRef: React.MutableRefObject<string>,
): Promise<void> => {
  const { galoyAuthToken, ...stateWithoutToken } = state
  try {
    await savePersistentStateBlob(stateWithoutToken)
  } catch (err) {
    // Storage failures are crash-adjacent: never downgrade on message wording.
    reportError("Persistent state save", err, { alwaysRecord: true })
  }
  if (galoyAuthToken !== lastPersistedTokenRef.current) {
    const ok = galoyAuthToken
      ? await KeyStoreWrapper.setActiveToken(galoyAuthToken)
      : await KeyStoreWrapper.removeActiveToken()
    if (ok) {
      // eslint-disable-next-line require-atomic-updates -- single writer; the provider's save queue serializes saves
      lastPersistedTokenRef.current = galoyAuthToken
    } else {
      // Ref stays stale so the next state change retries the keychain write.
      reportError("Active token keychain write", new Error("keystore write failed"), {
        alwaysRecord: true,
      })
    }
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
  const lastPersistedTokenRef = React.useRef("")
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve())

  React.useEffect(() => {
    if (hasModified.current && persistentState) {
      // Serialize saves: the ref update inside savePersistentState is
      // single-writer only because each save waits for the previous one.
      // (savePersistentState catches all its own failures, so the chain
      // cannot reject and wedge.)
      saveQueueRef.current = saveQueueRef.current.then(() =>
        savePersistentState(persistentState, lastPersistedTokenRef),
      )
    }
  }, [persistentState])

  React.useEffect(() => {
    ;(async () => {
      const { state: loadedState, persistedToken } = await loadPersistentState()
      lastPersistedTokenRef.current = persistedToken
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
