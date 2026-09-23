import { createContext, useContext, PropsWithChildren } from "react"
import * as React from "react"
import {
  readSelfCustodialIndexPresence,
  SelfCustodialIndexPresence,
  sweepMnemonicMigration,
} from "@app/self-custodial/storage/account-index"

import { recordAppError } from "@app/utils/error-reporting"

import { reportError } from "@app/utils/error-logging"
import {
  getAllKeys,
  loadString,
  readString,
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

/** Upper bound on the sweep's idle wait, so a busy boot still runs it. */
const SWEEP_IDLE_TIMEOUT_MS = 5000

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
  /**
   * This boot must not write the blob, for one of two reasons.
   *
   * Either the blob could not be read, so `state` is defaults rather than
   * anything loaded and saving would put those defaults over an intact file;
   * or a reinstall wipe is still owed and only stays owed while the blob is
   * absent. Both want the same thing: leave the file alone so the next boot
   * sees what this one saw.
   */
  holdBlobWrites?: boolean
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
  const reportFailure = (what: string) => {
    recordAppError(new Error(`Reinstall keychain cleanup failed: ${what}`), {
      alwaysRecord: true,
    })
  }

  // Genuinely a fresh install: the key is absent, not unreadable, not present
  // and empty, and an unrecognized schema is Failed. This branch owns only the
  // trigger and the reporting — WHICH credentials survive uninstall and must be
  // wiped is secureStorage's knowledge. It re-runs on every boot until the first
  // blob write, so a failed wipe also retries across boots.
  await KeyStoreWrapper.clearUninstallSurvivingCredentials(reportFailure)

  // The key material waits for corroboration the session credentials do not
  // need. Getting the verdict wrong costs a re-login on that side and someone's
  // money on this one, and the account index is a second witness: it lives in
  // AsyncStorage, which a real reinstall clears, so a successful read returning
  // accounts is proof this device is not one.
  //
  // A read that fails proves nothing either way, so it also holds the erase
  // back; the next boot re-runs this branch and can try again. Both skips are
  // reported, because a verdict that keeps being wrong is invisible otherwise.
  //
  // Absence is the signal, not an empty list: readIndex degrades a stored value
  // it cannot recognise to zero entries, so "no accounts" would otherwise let a
  // corrupted index authorise the erase it should have prevented.
  const presence = await readSelfCustodialIndexPresence()
  if (presence === SelfCustodialIndexPresence.Absent) {
    // An erase that ran and failed is as owed as one that never ran: the seeds
    // are still there, and nothing outside this branch can reach them once the
    // account ids are gone. So it holds the blob back on the same terms, and
    // the next boot tries the whole thing again.
    let erased = true
    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial((what) => {
      erased = false
      reportFailure(what)
    })
    return {
      state: defaultPersistentState,
      persistedToken: "",
      holdBlobWrites: !erased,
    }
  }

  if (presence === SelfCustodialIndexPresence.Present) {
    // Not a fresh install after all, so nothing is owed. The session half above
    // has already run, which costs a re-login and no key material.
    recordAppError(
      new Error("Reinstall key-material wipe skipped: account index is populated"),
      { alwaysRecord: true },
    )
    return { state: defaultPersistentState, persistedToken: "" }
  }

  // Unknown: the erase may still be owed, and this branch only fires while the
  // blob is absent. Holding the blob back is what keeps that true, so the next
  // boot reaches here again and asks the index a second time — the retry this
  // design assumes rather than a marker, which would have to live either where
  // an uninstall clears it (useless) or where it survives one (dangerous).
  recordAppError(
    new Error("Reinstall key-material wipe deferred: account index unreadable"),
    { alwaysRecord: true },
  )
  return { state: defaultPersistentState, persistedToken: "", holdBlobWrites: true }
}

/**
 * Boots on defaults while keeping whatever session the keychain still holds.
 * The credential lives there and is unaffected by anything that went wrong with
 * the blob: losing settings must not cost the session.
 */
const bootOnDefaultsKeepingSession = async (): Promise<LoadedPersistentState> => {
  const keychainToken = await KeyStoreWrapper.getActiveToken()
  return {
    state: { ...defaultPersistentState, galoyAuthToken: keychainToken },
    persistedToken: keychainToken,
  }
}

const handleUnusableBlob = async (
  error: Error,
  quarantine: () => Promise<void>,
): Promise<LoadedPersistentState> => {
  recordAppError(error, { alwaysRecord: true })
  await quarantine()
  return bootOnDefaultsKeepingSession()
}

/**
 * The store could not answer, which is the one thing an absent key must never
 * be confused with.
 *
 * Nothing is quarantined: the blob was not read, so there is no damage to
 * describe and no reason to assume any. Nothing is wiped either, which is the
 * whole point — the fresh-install branch destroys every credential that
 * outlives an uninstall, and since blinkbitcoin/blink-wip#1162 that includes
 * the mnemonics, from both stores. A transient AsyncStorage fault answered that
 * way would take a user's key material with it.
 *
 * This boot runs on defaults and the next one reads the blob again.
 */
const handleUnreadableStore = async (err: unknown): Promise<LoadedPersistentState> => {
  recordAppError(
    err instanceof Error ? err : new Error(`Persistent state read failed: ${err}`),
    { alwaysRecord: true },
  )
  return { ...(await bootOnDefaultsKeepingSession()), holdBlobWrites: true }
}

export const loadPersistentState = async (): Promise<LoadedPersistentState> => {
  // Fire-and-forget: quarantine hygiene must never delay app boot.
  scrubQuarantinedTokens().catch(() => {})

  // Read as text and parse here rather than via loadJson, which reports an
  // absent key and an unparseable one identically. That distinction is
  // load-bearing: "absent" triggers the reinstall wipe, and a truncated blob
  // must never be mistaken for a fresh install and cost the user every session
  // credential they have. readString draws the third one this branch needs — a
  // read that failed is not a key that is not there.
  // One immediate retry, no backoff, mirroring the wipe's removeWithRetry: the
  // failures worth a second attempt here are one-shot storage hiccups, and boot
  // cannot wait out anything longer-lived. Without it a persistent fault would
  // mean a session that never persists, every launch, which is worse for the
  // user than the one-time loss this replaces.
  let read = await readString(PERSISTENT_STATE_KEY)
  if (read.status === "failed") read = await readString(PERSISTENT_STATE_KEY)
  if (read.status === "failed") return handleUnreadableStore(read.err)

  let data: unknown = null
  if (read.status === "found") {
    const raw = read.value
    try {
      data = JSON.parse(raw)
    } catch (err) {
      return handleUnusableBlob(err instanceof Error ? err : new Error(String(err)), () =>
        quarantineUnparseableState(raw, err),
      )
    }

    // Parsed, but to something migratePersistentState scores as no data at all:
    // its guard is `if (!data)`, so a stored "null", "0" or "false" would reach
    // the fresh-install branch and spend the wipe on a device that never
    // reinstalled. A key that is present is evidence against a fresh install
    // whatever it holds, so this goes to the damaged-blob path, which also
    // quarantines a copy.
    if (!data) {
      return handleUnusableBlob(
        new Error("Persistent state parsed to an empty value"),
        () => quarantineUnparseableState(raw, new Error("empty parsed value")),
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
  skipBlob: boolean,
): Promise<void> => {
  const { galoyAuthToken, ...stateWithoutToken } = state
  // Held back only for the blob, never for the token below. The two live in
  // different stores and failed independently: the session is whatever the
  // keychain says, and a login during a load-failed boot has to survive it.
  if (!skipBlob) {
    try {
      await savePersistentStateBlob(stateWithoutToken)
    } catch (err) {
      // Storage failures are crash-adjacent: never downgrade on message wording.
      reportError("Persistent state save", err, { alwaysRecord: true })
    }
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
  /**
   * Set when this boot must not write the blob, and never cleared for the
   * session. See holdBlobWrites: either the blob was never read, or a reinstall
   * wipe is still owed and only the blob's absence keeps it owed.
   *
   * Changes still apply in memory; only the write is held back, and the
   * keychain token is independent and keeps saving.
   */
  const holdBlobWritesRef = React.useRef(false)

  React.useEffect(() => {
    if (hasModified.current && persistentState) {
      // Serialize saves: the ref update inside savePersistentState is
      // single-writer only because each save waits for the previous one.
      // (savePersistentState catches all its own failures, so the chain
      // cannot reject and wedge.)
      saveQueueRef.current = saveQueueRef.current.then(() =>
        savePersistentState(
          persistentState,
          lastPersistedTokenRef,
          holdBlobWritesRef.current,
        ),
      )
    }
  }, [persistentState])

  React.useEffect(() => {
    ;(async () => {
      const {
        state: loadedState,
        persistedToken,
        holdBlobWrites,
      } = await loadPersistentState()
      holdBlobWritesRef.current = Boolean(holdBlobWrites)
      lastPersistedTokenRef.current = persistedToken
      setPersistentState(loadedState)
      // Off the critical path and never awaited: the mnemonics of accounts the
      // user does not open would otherwise only migrate if something happened
      // to read them, and would be stranded when the legacy store is dropped.
      // Scheduled for the first idle window, so a slow keystore cannot compete
      // with the first frame. InteractionManager expresses the same intent but
      // is deprecated in this React Native version and warns on every boot.
      //
      // The timeout is what keeps the two equivalent: an idle callback with no
      // bound can be starved for a whole launch on a busy boot, and a launch
      // that never sweeps is a launch whose mnemonics never migrate.
      requestIdleCallback(
        () => {
          sweepMnemonicMigration().catch(() => {
            // Never rejects by contract; a caught error here would still be a
            // migration detail and must not reach a boot path.
          })
        },
        { timeout: SWEEP_IDLE_TIMEOUT_MS },
      )
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
