import { createContext, useContext, PropsWithChildren } from "react"
import * as React from "react"
import {
  purgeLegacyKeyStoreOnce,
  readSelfCustodialAccountIds,
  readSelfCustodialIndexPresence,
  SelfCustodialIndexPresence,
  StorageReadStatus,
  SWEEP_IDLE_TIMEOUT_MS,
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
import KeyStoreWrapper, {
  type GaloyAuthTokenKey,
  type ReinstallSessionSlot,
} from "@app/utils/storage/secureStorage"

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
  /**
   * The blob could not be read, so `state` is defaults rather than anything
   * loaded. Saving would put those defaults over a file that is still intact
   * and would have read fine next launch, which is how a momentary storage
   * fault becomes permanent loss of every preference.
   */
  holdBlobWrites?: boolean
  /**
   * The loader changed the state it is handing back — today only by clearing an
   * owed reinstall wipe — so it has to be written even though the user has
   * touched nothing.
   */
  stateChanged?: boolean
}

const handleMigratedState = async (
  state: PersistentState,
  { isActiveTokenOwed }: { isActiveTokenOwed: boolean },
): Promise<LoadedPersistentState> => {
  // The slot still holds what a reinstall wipe could not erase, which may be the previous
  // owner's token, so this boot starts signed out rather than in their account.
  if (isActiveTokenOwed) {
    return { state: { ...state, galoyAuthToken: "" }, persistedToken: "" }
  }

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

/** How every step of the reinstall wipe reports a slot it could not erase, by name. */
const reportReinstallCleanupFailure = (what: string) => {
  recordAppError(new Error(`Reinstall keychain cleanup failed: ${what}`), {
    alwaysRecord: true,
  })
}

/**
 * Collects the failures of an erase that runs in more than one step, so the
 * caller can ask one question at the end: did all of it complete?
 *
 * A step that ran and failed leaves the seeds exactly where a step that never
 * ran does, so both have to reach the same answer — that is what marks the
 * erase still owed instead of silently reporting a wipe that only half
 * happened.
 */
const createEraseTracker = (reportFailure: (what: string) => void) => {
  let erased = true
  return {
    onFailure: (what: string) => {
      erased = false
      reportFailure(what)
    },
    isComplete: () => erased,
  }
}

const withoutOwedWipe = (state: PersistentState): PersistentState => {
  const { pendingReinstallKeyMaterialWipe: _owed, ...rest } = state
  return rest
}

const withOwedWipe = (state: PersistentState): PersistentState => ({
  ...state,
  pendingReinstallKeyMaterialWipe: true,
})

/** The literal the token slot is recorded under, pinned to secureStorage's at compile time. */
const ACTIVE_TOKEN_SLOT: ReinstallSessionSlot = "active token"

/**
 * The session slots the blob says are still owed. A value that is not a list reads as none:
 * the names are only ever written by this file, and secureStorage skips one it does not
 * know, so nothing here erases on a guess.
 */
const owedSessionSlotsOf = (state: PersistentState | null): ReinstallSessionSlot[] => {
  const owed: unknown = state?.pendingReinstallSessionWipe
  if (!Array.isArray(owed)) return []
  return owed.filter((slot): slot is ReinstallSessionSlot => typeof slot === "string")
}

/** Records whether the whole legacy store still has to be cleared, and drops the marker
 *  once it does not. */
const withLegacyStoreClearOwed = (
  state: PersistentState,
  isOwed: boolean,
): PersistentState => {
  const { pendingReinstallLegacyStoreClear: _owed, ...rest } = state
  return isOwed ? { ...rest, pendingReinstallLegacyStoreClear: true } : rest
}

/** Records exactly these slots as owed, and drops the marker once there are none. */
const withOwedSessionWipe = (
  state: PersistentState,
  slots: ReadonlyArray<ReinstallSessionSlot>,
): PersistentState => {
  const { pendingReinstallSessionWipe: _owed, ...rest } = state
  const isAnySlotOwed = slots.length > 0
  return isAnySlotOwed ? { ...rest, pendingReinstallSessionWipe: [...slots] } : rest
}

/**
 * What a reset leaves: every setting back at its default, and an owed reinstall
 * wipe still owed. Neither marker is a setting. They stand for what the previous
 * owner left on the device, and a logout does not tell whose it erased, so only
 * the retries retire them, by finishing what they owe.
 */
const resetKeepingOwedWipe = (current: PersistentState | null): PersistentState => {
  const reset = withLegacyStoreClearOwed(
    withOwedSessionWipe(defaultPersistentState, owedSessionSlotsOf(current)),
    Boolean(current?.pendingReinstallLegacyStoreClear),
  )
  return current?.pendingReinstallKeyMaterialWipe ? withOwedWipe(reset) : reset
}

const handleFreshInstall = async (): Promise<LoadedPersistentState> => {
  // Read before anything is erased, because both erases below are gated on it.
  //
  // The index is the second witness the key material waits for and the session
  // credentials do not: it lives in AsyncStorage, which a real reinstall clears,
  // so accounts still listed prove this device is not one. Absence is the
  // signal, never an empty list — readIndex degrades a value it cannot
  // recognise to zero entries, which would let a corrupted index authorise the
  // erase it should have prevented. A read that fails proves nothing either
  // way, and is reported, because a verdict that keeps being wrong is invisible.
  const presence = await readSelfCustodialIndexPresence()

  // Two steps with the session wipe between them, so failures are collected
  // rather than answered one at a time.
  const keyMaterial = createEraseTracker(reportReinstallCleanupFailure)
  const legacyStore = createEraseTracker(reportReinstallCleanupFailure)

  // Before either half, and only on a confirmed reinstall — see
  // clearLegacyKeyStore for what it does and why it goes first. On a false
  // positive it would take the legacy mnemonic copies that mnemonicSlotFor
  // keeps as rollback insurance, and a re-login is not worth that.
  //
  // Its failure is recorded on a marker of its own. Those copies are seeds a
  // reinstall left behind, some of them named by no tracked id, and this boot is
  // the proof of a reinstall that lets the store go whole, so a later boot retries
  // it whatever the index says by then.
  if (presence === SelfCustodialIndexPresence.Absent) {
    await KeyStoreWrapper.clearLegacyKeyStore(legacyStore.onFailure)
  }

  // This branch owns only the trigger and the reporting; WHICH credentials
  // survive uninstall is secureStorage's knowledge. A slot it could not erase is
  // recorded and written at once, whatever the index says: the written blob is what
  // keeps this branch from running again, so the record is the only thing that
  // brings a later boot back for it.
  const owedSessionSlots = await KeyStoreWrapper.clearUninstallSurvivingCredentials(
    reportReinstallCleanupFailure,
  )
  const isLegacyStoreClearOwed = !legacyStore.isComplete()
  const freshState = withLegacyStoreClearOwed(
    withOwedSessionWipe(defaultPersistentState, owedSessionSlots),
    isLegacyStoreClearOwed,
  )
  const isFreshStateOwed = owedSessionSlots.length > 0 || isLegacyStoreClearOwed

  if (presence === SelfCustodialIndexPresence.Absent) {
    // An erase that ran and failed is as owed as one that never ran: the seeds
    // are still there, and nothing outside this branch can reach them once the
    // account ids are gone. The blob is written either way, marked with what is
    // still owed — holding it back would keep re-triggering the session wipe
    // above, which signs the user out on every launch with nothing to end it.
    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(keyMaterial.onFailure)
    if (keyMaterial.isComplete()) {
      return { state: freshState, persistedToken: "", stateChanged: isFreshStateOwed }
    }
    // stateChanged, because nothing else will write this blob: the user has
    // touched nothing on a launch that just signed them out, and a marker that
    // is never written is a marker the next boot cannot read.
    return {
      state: withOwedWipe(freshState),
      persistedToken: "",
      stateChanged: true,
    }
  }

  if (presence === SelfCustodialIndexPresence.Present) {
    // Not a fresh install after all, so nothing is owed. The session half above
    // has already run, which costs a re-login and no key material.
    recordAppError(
      new Error("Reinstall key-material wipe skipped: account index is populated"),
      { alwaysRecord: true },
    )
    return { state: freshState, persistedToken: "", stateChanged: isFreshStateOwed }
  }

  // Unknown: the index could not answer, so the erase may still be owed. It is
  // recorded in the blob rather than kept alive by withholding the blob — the
  // marker is cleared by an uninstall, which is exactly right, because a real
  // reinstall should start the whole verdict over.
  recordAppError(
    new Error("Reinstall key-material wipe deferred: account index unreadable"),
    { alwaysRecord: true },
  )
  return {
    state: withOwedWipe(freshState),
    persistedToken: "",
    stateChanged: true,
  }
}

/**
 * The session slots a reinstall wipe could not erase, retried on a later boot until each
 * is gone, whatever the account index says.
 *
 * It runs before the active token is read. A token the previous owner left is a session
 * into their account, and a slot that still will not erase tells the read to leave it
 * alone, so the boot starts signed out instead.
 *
 * What it costs: a slot the new owner wrote after a failed wipe is theirs by then, and
 * this erases it anyway, which means one more sign-in or setting the lock again. Nothing
 * here can tell the two values apart, and leaving the previous owner's sign-in or lock on
 * the device costs more than either.
 */
const retryOwedSessionWipe = async (
  state: PersistentState,
): Promise<{ state: PersistentState; changed: boolean; isActiveTokenOwed: boolean }> => {
  const owed = owedSessionSlotsOf(state)
  const isAnySlotOwed = owed.length > 0
  if (!isAnySlotOwed) return { state, changed: false, isActiveTokenOwed: false }

  const stillOwed = await KeyStoreWrapper.clearUninstallSurvivingCredentials(
    reportReinstallCleanupFailure,
    owed,
  )
  return {
    state: withOwedSessionWipe(state, stillOwed),
    changed: stillOwed.length !== owed.length,
    isActiveTokenOwed: stillOwed.includes(ACTIVE_TOKEN_SLOT),
  }
}

/**
 * The tracked mnemonics an owed erase still has to reach, by what the index says now.
 *
 * While the device has no account of its own it takes every tracked mnemonic, as the
 * reinstall boot would have. Once one exists, the tracked list names that account's
 * mnemonic too, so it spares every account the index names and takes the rest: the
 * previous owner's, each with its legacy copy. That needs the index read in full, since
 * an id it failed to name is a wallet whose seed would be erased, so a read that cannot
 * vouch for every entry keeps the erase owed for the next boot instead.
 */
const eraseOwedTrackedMnemonics = async (
  state: PersistentState,
  presence: SelfCustodialIndexPresence,
): Promise<PersistentState> => {
  if (presence === SelfCustodialIndexPresence.Unknown) return state

  let spared: ReadonlySet<string> = new Set()
  if (presence === SelfCustodialIndexPresence.Present) {
    const indexed = await readSelfCustodialAccountIds()
    if (indexed.status === StorageReadStatus.ReadFailed) return state
    spared = new Set(indexed.ids)
  }

  const keyMaterial = createEraseTracker(reportReinstallCleanupFailure)
  await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(keyMaterial.onFailure, spared)
  return keyMaterial.isComplete() ? withoutOwedWipe(state) : state
}

/**
 * The key-material erase a reinstall still owes, retried on a later boot. Two debts with
 * different rules, so two markers.
 *
 * The legacy store goes whole only on proof of a reinstall: a boot that found the index
 * absent and recorded the clear as owed, or an index absent now. Once proven it is retried
 * whatever the index says later, because it is the only thing that reaches a previous
 * owner's legacy-only seeds, which no tracked id names, and the new owner writes nothing
 * to that store. A marker an unreadable index left proves nothing, and there the legacy
 * store can still hold this user's only copy of a seed the sweep has not moved yet, so
 * that case reaches the tracked mnemonics alone.
 *
 * It runs before the tracked mnemonics, as on the reinstall boot: `removeThrough` empties
 * the new store only once the legacy copy is provably gone.
 */
const retryOwedKeyMaterialWipe = async (
  state: PersistentState,
): Promise<{ state: PersistentState; changed: boolean }> => {
  const isKeyMaterialOwed = Boolean(state.pendingReinstallKeyMaterialWipe)
  const isLegacyStoreClearOwed = Boolean(state.pendingReinstallLegacyStoreClear)
  const isAnythingOwed = isKeyMaterialOwed || isLegacyStoreClearOwed
  if (!isAnythingOwed) return { state, changed: false }

  const presence = await readSelfCustodialIndexPresence()

  let next = state
  const isReinstallProven =
    isLegacyStoreClearOwed || presence === SelfCustodialIndexPresence.Absent
  if (isReinstallProven) {
    const legacyStore = createEraseTracker(reportReinstallCleanupFailure)
    await KeyStoreWrapper.clearLegacyKeyStore(legacyStore.onFailure)
    next = withLegacyStoreClearOwed(next, !legacyStore.isComplete())
  }

  if (isKeyMaterialOwed) next = await eraseOwedTrackedMnemonics(next, presence)

  const isLegacyMarkerChanged =
    Boolean(next.pendingReinstallLegacyStoreClear) !== isLegacyStoreClearOwed
  const isKeyMaterialMarkerChanged =
    Boolean(next.pendingReinstallKeyMaterialWipe) !== isKeyMaterialOwed
  return { state: next, changed: isLegacyMarkerChanged || isKeyMaterialMarkerChanged }
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
    case MigrationStatus.Ok: {
      // A reinstall whose wipe never finished records what it still owes in the
      // blob, and this is the boot that acts on it: the session slots before the
      // token is read, so a token the previous owner left never becomes this session.
      const session = await retryOwedSessionWipe(result.state)
      const loaded = await handleMigratedState(session.state, {
        isActiveTokenOwed: session.isActiveTokenOwed,
      })
      const keyMaterial = await retryOwedKeyMaterialWipe(loaded.state)
      const isStateChanged = session.changed || keyMaterial.changed
      return { ...loaded, state: keyMaterial.state, stateChanged: isStateChanged }
    }
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
 *
 * Returns whether the credential is provably gone, because a caller erasing the app lock
 * has to know: a lock dropped over a bearer token that survived in the keychain leaves that
 * token recoverable on the next launch with nothing in front of it.
 */
const removeActiveTokenDurably = async (
  lastPersistedTokenRef: React.MutableRefObject<string>,
): Promise<boolean> => {
  const ok =
    (await KeyStoreWrapper.removeActiveToken()) ||
    (await KeyStoreWrapper.removeActiveToken())
  if (ok) {
    // eslint-disable-next-line require-atomic-updates -- single writer; the provider's save queue serializes this with saves
    lastPersistedTokenRef.current = ""
    return true
  }

  reportError("Active token keychain removal", new Error("keystore remove failed"), {
    alwaysRecord: true,
  })
  return false
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
   *
   * Resolves to whether the keychain copy is provably gone. A caller that erases the app
   * lock on the strength of "nothing is left" has to include this: a lock dropped over a
   * surviving bearer token leaves it recoverable with nothing in front of it.
   */
  clearToken: () => Promise<boolean>
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
        stateChanged,
      } = await loadPersistentState()
      holdBlobWritesRef.current = Boolean(holdBlobWrites)
      lastPersistedTokenRef.current = persistedToken
      // The load itself changed the state, so the save effect below has to run
      // without waiting for the user to touch anything.
      if (stateChanged) hasModified.current = true
      setPersistentState(loadedState)
      // Off the critical path and never awaited: the mnemonics of accounts the
      // user does not open would otherwise migrate only if something happened
      // to read them, and would be stranded when the legacy store is dropped.
      // InteractionManager expresses the same intent but is deprecated in this
      // React Native version and warns on every boot; SWEEP_IDLE_TIMEOUT_MS is
      // what keeps the two equivalent.
      //
      // No cleanup and the handle discarded, which is safe rather than
      // overlooked: the sweep is idempotent and its writes take their turn in
      // the slot queue, so a second schedule — a fast remount, or StrictMode in
      // development — costs one pass over an index with nothing left to move.
      requestIdleCallback(
        () => {
          // The purge is chained onto the sweep rather than scheduled beside it:
          // the pass runs either way, but it records itself as done only over a
          // sweep that confirmed every account, so it needs the sweep's verdict.
          sweepMnemonicMigration()
            .then(purgeLegacyKeyStoreOnce)
            .catch(() => {
              // Neither rejects by contract; a caught error here would still be
              // a migration detail and must not reach a boot path.
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
    setPersistentState(resetKeepingOwedWipe)
  }, [])

  const clearToken = React.useCallback(async (): Promise<boolean> => {
    hasModified.current = true
    // Through the same queue as the saves, so the ref has exactly one writer at
    // a time. Awaited by the caller: logout must know the credential is gone
    // before it moves on, rather than leaving it to the next render's save —
    // a crash in between would otherwise resurrect a session whose profile has
    // already been deleted.
    const removal = saveQueueRef.current.then(() =>
      removeActiveTokenDurably(lastPersistedTokenRef),
    )
    /** The queue only orders the writes, so it takes the removal stripped of its answer;
     *  the answer goes to the caller, which decides whether the app lock may go with it. */
    saveQueueRef.current = removal.then(() => undefined)
    setPersistentState((prev) => (prev ? { ...prev, galoyAuthToken: "" } : prev))
    return removal
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
