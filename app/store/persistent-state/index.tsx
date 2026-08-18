import { createContext, useContext, PropsWithChildren } from "react"
import * as React from "react"

import { recordAppError } from "@app/utils/error-reporting"

import { reportError } from "@app/utils/error-logging"
import { getAllKeys, loadString, saveJson, saveString } from "@app/utils/storage"
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

/**
 * Quarantine for a blob we could NOT parse.
 *
 * The parsed path redacts a known field; here there is no field to reach — the
 * bytes may be truncated mid-token or mangled around the key name, so no
 * redaction pass can promise the credential is gone. Since the whole point of
 * this branch is that the token must never sit in plaintext AsyncStorage, we
 * quarantine a description of the damage rather than the damage itself: enough
 * to tell truncation from garbage, with nothing to leak.
 */
const quarantineUnparseableState = async (raw: string, err: unknown): Promise<void> => {
  await quarantineRawState({
    unparseable: true,
    byteLength: raw.length,
    parseError: err instanceof Error ? err.message : String(err),
  })
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
    if (!keys) {
      // A failed listing is not an empty store: marking the sweep done here
      // would retire it forever with the legacy plaintext copies still in place.
      recordAppError(new Error("Quarantine sweep could not list storage keys"), {
        alwaysRecord: true,
      })
      return
    }
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

const handleMigratedState = async (
  state: PersistentState,
): Promise<LoadedPersistentState> => {
  const read = await KeyStoreWrapper.readActiveToken()
  const keychainToken = read.status === "found" ? read.token : ""
  // Blobs written before the token moved to the keychain still carry it;
  // post-scrub blobs don't, and migrations just spread the field through.
  const blobToken = state.galoyAuthToken ?? ""
  // The keychain is the source of truth once populated; the blob copy is
  // only adopted while the keychain slot is empty.
  let adopted = read.status === "found"
  if (blobToken && !adopted) {
    if (read.status === "failed") {
      // An empty read that is really a failed read would overwrite whatever the
      // slot holds with the older blob copy and then scrub the blob — losing a
      // newer token entirely. Leave both stores alone and retry next boot.
      recordAppError(new Error("Active token keychain read failed; adoption skipped"), {
        alwaysRecord: true,
      })
      return { state, persistedToken: "" }
    }
    adopted = await KeyStoreWrapper.setActiveToken(blobToken)
  }
  if (blobToken) {
    if (adopted) {
      const { galoyAuthToken: _, ...scrubbed } = state
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
    state: { ...state, galoyAuthToken: keychainToken || blobToken },
    persistedToken: keychainToken || (adopted ? blobToken : ""),
  }
}

const handleFreshInstall = async (): Promise<LoadedPersistentState> => {
  // Genuinely a fresh install: the key is absent, not unreadable, and an
  // unrecognized schema is Failed. This branch owns only the trigger and the
  // reporting — WHICH credentials survive uninstall and must be wiped is
  // secureStorage's knowledge. It re-runs on every boot until the first blob
  // write, so a failed wipe also retries across boots.
  await KeyStoreWrapper.clearUninstallSurvivingCredentials((what) => {
    recordAppError(new Error(`Reinstall keychain cleanup failed: ${what}`), {
      alwaysRecord: true,
    })
  })
  return { state: defaultPersistentState, persistedToken: "" }
}

const handleUnusableBlob = async (
  error: Error,
  quarantine: () => Promise<void>,
): Promise<LoadedPersistentState> => {
  recordAppError(error, { alwaysRecord: true })
  await quarantine()
  // The credential lives in the keychain and is unaffected by blob damage:
  // losing settings must not cost the session.
  const keychainToken = await KeyStoreWrapper.getActiveToken()
  return {
    state: { ...defaultPersistentState, galoyAuthToken: keychainToken },
    persistedToken: keychainToken,
  }
}

export const loadPersistentState = async (): Promise<LoadedPersistentState> => {
  // Fire-and-forget: quarantine hygiene must never delay app boot.
  scrubQuarantinedTokens().catch(() => {})

  // Read as text and parse here rather than via loadJson, which reports an
  // absent key and an unparseable one identically. That distinction is now
  // load-bearing: "absent" triggers the reinstall wipe, and a truncated blob
  // must never be mistaken for a fresh install and cost the user every session
  // credential they have. (A getItem that throws still surfaces as null, so a
  // failed read remains indistinguishable from an absent key — closing that
  // would mean changing loadString's contract for all of its callers.)
  const raw = await loadString(PERSISTENT_STATE_KEY)
  let data: unknown = null
  if (raw !== null) {
    try {
      data = JSON.parse(raw)
    } catch (err) {
      return handleUnusableBlob(err instanceof Error ? err : new Error(String(err)), () =>
        quarantineUnparseableState(raw, err),
      )
    }
  }

  const result = await migratePersistentState(data)
  switch (result.status) {
    case MigrationStatus.Ok:
      return handleMigratedState(result.state)
    case MigrationStatus.NoData:
      return handleFreshInstall()
    case MigrationStatus.Failed:
      return handleUnusableBlob(result.error, () => quarantineRawState(result.rawData))
  }
}

/**
 * Removes the durable token and keeps the dirty-check ref honest about it.
 *
 * Retried once, mirroring clearUninstallSurvivingCredentials: a swallowed
 * failure here leaves a session credential behind after the profile backing it
 * is gone. On persistent failure the ref keeps the old value, so the next save
 * sees a mismatch and tries again.
 */
const removeActiveTokenDurably = async (
  lastPersistedTokenRef: React.MutableRefObject<string>,
): Promise<void> => {
  const ok =
    (await KeyStoreWrapper.removeActiveToken()) ||
    (await KeyStoreWrapper.removeActiveToken())
  if (ok) {
    // eslint-disable-next-line require-atomic-updates -- single writer; the provider's save queue serializes this with saves
    lastPersistedTokenRef.current = ""
  } else {
    reportError("Active token keychain removal", new Error("keystore remove failed"), {
      alwaysRecord: true,
    })
  }
}

/**
 * Blob first, keychain second. The order is a choice, not an accident, and it
 * leaves a window: a crash between the two writes boots the next launch with
 * the new settings (including activeAccountId) beside the previous token.
 * Reordering only moves the mismatch, and the two stores cannot be written
 * atomically, so the window is accepted rather than closed — the blob is the
 * recoverable half, and a token that no longer matches the settings fails the
 * next authenticated call and takes the existing 401 path. Anything stronger
 * would mean storing the settings that must agree with the token inside the
 * keychain value itself.
 */
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
    if (!galoyAuthToken) {
      await removeActiveTokenDurably(lastPersistedTokenRef)
      return
    }
    const ok = await KeyStoreWrapper.setActiveToken(galoyAuthToken)
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
  /**
   * Drops the active session token from memory AND from the keychain, durably,
   * before it resolves.
   *
   * Callers used to reach for KeyStoreWrapper.removeActiveToken directly, which
   * left the provider's dirty-check ref believing the keychain still held a
   * token it no longer had — after which every subsequent save saw "nothing
   * changed" and skipped the write. The provider owns that slot; going through
   * it keeps the ref and the keychain in step by construction.
   */
  clearToken: () => Promise<void>
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

  const clearToken = React.useCallback(async () => {
    hasModified.current = true
    // Through the same queue as the saves, so the ref has exactly one writer at
    // a time. Awaited by the caller: logout must know the credential is gone
    // before it moves on, rather than leaving it to the next render's save —
    // a crash in between would otherwise resurrect a session whose profile has
    // already been deleted.
    const removal = saveQueueRef.current.then(() =>
      removeActiveTokenDurably(lastPersistedTokenRef),
    )
    saveQueueRef.current = removal
    setPersistentState((prev) => (prev ? { ...prev, galoyAuthToken: "" } : prev))
    await removal
  }, [])

  if (!persistentState) return null

  return (
    <PersistentStateContext.Provider
      value={{ persistentState, updateState, resetState, clearToken }}
    >
      {children}
    </PersistentStateContext.Provider>
  )
}

export const usePersistentStateContext = (() =>
  useContext(PersistentStateContext)) as () => PersistentStateContextType
