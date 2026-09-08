import { ACCESSIBLE } from "react-native-keychain"

import { eraseEntireLegacyStore, legacyRead } from "./legacy-key-store"
import { type SecureExists, secureRead, secureRemove, secureWrite } from "./secure-store"
import {
  eraseLegacyCopy,
  type ReadThroughArgs,
  existsThrough,
  onSlot,
  readThrough,
  removeThrough,
  writeThrough,
} from "./secure-store-migration"

// The keychain slot and the legacy persisted-blob field share this name.
// Pinned forever: existing installs already store entries under it.
export const GALOY_AUTH_TOKEN_KEY = "galoyAuthToken"
// Type-level handle so other modules can pin their own copy of the literal to
// this one at compile time without a runtime import (specs mock this module
// wholesale, which would erase a runtime named export).
export type GaloyAuthTokenKey = typeof GALOY_AUTH_TOKEN_KEY

/**
 * The outcome of a keychain read, with "nothing stored" kept distinct from
 * "the read failed" — see readActiveToken.
 */
export type ActiveTokenRead =
  | { status: "found"; token: string }
  | { status: "absent" }
  | { status: "failed"; err: unknown }

/**
 * The outcome of a session-profiles read, with "nothing stored" kept distinct
 * from "the read failed" — see readSessionProfiles.
 */
export type SessionProfilesRead =
  | { status: "found"; profiles: ProfileProps[] }
  | { status: "absent" }
  | { status: "failed"; err: unknown }

/**
 * The failed-PIN state, stored as one value under one key — see the note above
 * the PIN lockout block.
 */
export type PinFailureState = {
  /** Consecutive wrong-PIN entries. */
  readonly attempts: number
  /** Epoch ms the lock lifts at; 0 when no lock is in force. */
  readonly lockedUntil: number
}

export type PinFailureStateRead =
  | { readonly status: "found"; readonly state: PinFailureState }
  | { readonly status: "absent" }
  | { readonly status: "failed"; readonly err: unknown }

type SecureStoreRead =
  | { readonly status: "found"; readonly value: string }
  | { readonly status: "absent" }
  | { readonly status: "failed"; readonly err: unknown }

/**
 * What the tracked account list holds, or why it could not be produced.
 *
 * Three answers, because collapsing any two of them destroys something.
 * `failed` read as `ok` with no ids would make the next write drop every id
 * already tracked; `malformed` read that way would let the reinstall wipe
 * report a clean sweep over mnemonics it never looked at.
 */
type MnemonicAccountsRead =
  | { readonly status: "ok"; readonly accountIds: readonly string[] }
  | { readonly status: "malformed" }
  | { readonly status: "failed" }

/**
 * Account ids and nothing else. A single entry of another type is enough to
 * make the list untrustworthy: the wipe would then work from a partial one and
 * report the mnemonics it skipped as cleared.
 */
const isAccountIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === "string")

const CLEARED_PIN_FAILURE_STATE: PinFailureState = { attempts: 0, lockedUntil: 0 }

export default class KeyStoreWrapper {
  private static readonly IS_BIOMETRICS_ENABLED = "isBiometricsEnabled"
  private static readonly PIN = "PIN"
  private static readonly PIN_FAILURE_STATE = "pinFailureState"
  /** Pre-lockout releases stored the bare attempt count here. Read once, then
   *  erased — see getPinFailureState. */
  private static readonly LEGACY_PIN_ATTEMPTS = "pinAttempts"
  private static readonly SESSION_PROFILES = "sessionProfiles"
  private static readonly ACTIVE_TOKEN = GALOY_AUTH_TOKEN_KEY
  private static readonly MNEMONIC = "mnemonic"
  private static readonly MNEMONIC_NETWORK = "mnemonic_network"
  /**
   * Which accounts hold a mnemonic, so the reinstall wipe below can reach keys
   * whose names carry an account id. The app's own index lives in AsyncStorage,
   * which a reinstall clears, and enumerating the keychain is the one refactor
   * this area must not have — see clearUninstallSurvivingCredentials. Storing
   * the list beside the values it describes is what leaves the wipe with a
   * fixed slot list and no enumeration.
   *
   * Account ids only. A leaked id names nothing a mnemonic could unlock.
   */
  private static readonly MNEMONIC_ACCOUNTS = "mnemonicAccounts"

  /**
   * The protection class and erase rule for the six session slots that moved in
   * blinkbitcoin/blink-wip#1161. Mnemonics moved too, in
   * blinkbitcoin/blink-wip#1162, but on different terms — see mnemonicSlotFor.
   *
   * **The protection class changes for all of them.**
   * `react-native-keychain` has no `ALWAYS_THIS_DEVICE_ONLY` — Apple deprecated
   * `kSecAttrAccessibleAlwaysThisDeviceOnly` in iOS 12 — and the closest class
   * is a strict improvement: the old one was readable while the device was
   * locked. What it costs is one window. `Info.plist` declares
   * `UIBackgroundModes: remote-notification`, so a silent push can launch the
   * app after a reboot but before the first passcode entry, where an
   * `AFTER_FIRST_UNLOCK*` read returns `errSecInteractionNotAllowed` and the
   * adapter reports `failed`. Every caller below is written so that `failed` is
   * never scored as absent — that scoring is the only thing that turns this
   * window into an incident.
   *
   * **`deleteLegacyOnMigrate` is true for all of them.** These values mutate: a
   * PIN changes, a token rotates, profiles churn. A surviving legacy copy would
   * be a stale-credential resurrection on downgrade, and a revoked token coming
   * back to life is worse than a session that is merely gone.
   *
   * On Android this is all a no-op: both libraries ignore `accessible` there.
   */
  private static readonly MIGRATED_ACCESSIBLE =
    ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY

  private static slotFor(key: string): ReadThroughArgs {
    return {
      slot: key,
      legacyKey: key,
      accessible: KeyStoreWrapper.MIGRATED_ACCESSIBLE,
      deleteLegacyOnMigrate: true,
    }
  }

  /**
   * The mnemonic slots differ from every other migrated slot in two ways, both
   * because losing one costs someone their money rather than a re-login
   * (blinkbitcoin/blink-wip#1162).
   *
   * **The protection class does not change.** These are already
   * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` and stay there, so the silent-push window
   * that `MIGRATED_ACCESSIBLE` accepts for the session slots never applies here.
   *
   * **The legacy copy is kept.** A mnemonic is immutable per account, so the two
   * stores cannot diverge and the stale-value argument that justifies erasing
   * the other slots does not hold. What retaining it buys is a downgrade and
   * rollback that still find the value. The copies go in the explicit purge of
   * blinkbitcoin/blink-wip#1163, never on the read path.
   */
  private static mnemonicSlotFor(key: string): ReadThroughArgs {
    return {
      slot: key,
      legacyKey: key,
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      deleteLegacyOnMigrate: false,
    }
  }

  // ── migrated-slot primitives ──────────────────────────────────────────────
  // Reads and existence probes go through the read-through helper, so a slot
  // still living in the legacy store migrates the first time it is touched.
  // Writes never read through: they land in the new store only.

  private static async migratedWrite(key: string, value: string): Promise<boolean> {
    return writeThrough({
      slot: key,
      value,
      accessible: KeyStoreWrapper.MIGRATED_ACCESSIBLE,
    })
  }

  private static async migratedErase(key: string): Promise<boolean> {
    return removeThrough({ slot: key, legacyKey: key })
  }

  private static async migratedReadWithStatus(key: string): Promise<SecureStoreRead> {
    return readThrough(KeyStoreWrapper.slotFor(key))
  }

  /** Collapses absent and failed for callers where either means do nothing. */
  private static async migratedRead(key: string): Promise<string | null> {
    const read = await KeyStoreWrapper.migratedReadWithStatus(key)
    return read.status === "found" ? read.value : null
  }

  // ── biometrics ────────────────────────────────────────────────────────────

  /**
   * Whether the flag is set, with "the store could not answer" kept separate.
   * The gates that decide whether to show the lock screen must use this and
   * treat `failed` as enabled: scoring it as absent is what silently unlocks
   * the app during the pre-first-unlock window this slot's new protection
   * class introduces.
   */
  public static async readIsBiometricsEnabled(): Promise<SecureExists> {
    return existsThrough(KeyStoreWrapper.slotFor(KeyStoreWrapper.IS_BIOMETRICS_ENABLED))
  }

  /**
   * Collapses failed to false, which is what every caller did before this slot
   * moved. Safe only where a false merely hides a settings toggle; use
   * readIsBiometricsEnabled anywhere it decides whether the app is locked.
   */
  public static async getIsBiometricsEnabled(): Promise<boolean> {
    const read = await KeyStoreWrapper.readIsBiometricsEnabled()
    return read.status === "yes"
  }

  public static async setIsBiometricsEnabled(): Promise<boolean> {
    return KeyStoreWrapper.migratedWrite(KeyStoreWrapper.IS_BIOMETRICS_ENABLED, "1")
  }

  public static async removeIsBiometricsEnabled(): Promise<boolean> {
    return KeyStoreWrapper.migratedErase(KeyStoreWrapper.IS_BIOMETRICS_ENABLED)
  }

  // ── the PIN itself ────────────────────────────────────────────────────────

  /**
   * Whether a PIN is set, with "the store could not answer" kept separate. The
   * gates that decide whether to lock the app must use this and treat `failed`
   * as enabled: a false there skips the lock screen outright.
   */
  public static async readIsPinEnabled(): Promise<SecureExists> {
    return existsThrough(KeyStoreWrapper.slotFor(KeyStoreWrapper.PIN))
  }

  /** Collapses failed to false — see readIsPinEnabled before using it on a gate. */
  public static async getIsPinEnabled(): Promise<boolean> {
    const read = await KeyStoreWrapper.readIsPinEnabled()
    return read.status === "yes"
  }

  /**
   * `null` means the PIN could not be read — which this library cannot tell
   * apart from "no PIN is set", so both arrive that way. Callers must not score
   * it as a wrong entry: a keystore that throws transiently would otherwise
   * spend the attempt budget of a user who typed nothing wrong.
   */
  public static async getPin(): Promise<string | null> {
    return KeyStoreWrapper.migratedRead(KeyStoreWrapper.PIN)
  }

  public static async setPin(pin: string): Promise<boolean> {
    return KeyStoreWrapper.migratedWrite(KeyStoreWrapper.PIN, pin)
  }

  public static async removePin(): Promise<boolean> {
    return KeyStoreWrapper.migratedErase(KeyStoreWrapper.PIN)
  }

  // ── PIN lockout ───────────────────────────────────────────────────────────
  // The attempt count and the lock expiry are one logical value, so they live
  // under one key as one serialized write. Two keys made a write non-atomic:
  // if only the lock landed, the failure itself was lost, and the attacker got
  // a free attempt cycle back the moment the lock expired.

  public static async getPinFailureState(): Promise<PinFailureStateRead> {
    const current = await KeyStoreWrapper.migratedReadWithStatus(
      KeyStoreWrapper.PIN_FAILURE_STATE,
    )

    if (current.status === "found") {
      return {
        status: "found",
        state: KeyStoreWrapper.parsePinFailureState(current.value),
      }
    }
    if (current.status === "failed") return current

    // Upgrade path: an install that failed a PIN before this release has an
    // attempt count and no lock. Reading it keeps that budget spent; the next
    // write moves it to the new key and erases this one.
    const legacy = await KeyStoreWrapper.migratedReadWithStatus(
      KeyStoreWrapper.LEGACY_PIN_ATTEMPTS,
    )
    if (legacy.status === "failed") return legacy
    if (legacy.status === "absent") return { status: "absent" }

    const attempts = Number(legacy.value)
    return {
      status: "found",
      state: {
        attempts: Number.isFinite(attempts) ? attempts : 0,
        lockedUntil: 0,
      },
    }
  }

  /** Missing, corrupt and non-finite all collapse to a clean slate, so no NaN
   *  can escape into a comparison downstream. */
  private static parsePinFailureState(raw: string): PinFailureState {
    try {
      const parsed = JSON.parse(raw)
      const attempts = Number(parsed?.attempts)
      const lockedUntil = Number(parsed?.lockedUntil)
      if (!Number.isFinite(attempts) || !Number.isFinite(lockedUntil)) {
        return CLEARED_PIN_FAILURE_STATE
      }
      return { attempts, lockedUntil }
    } catch {
      return CLEARED_PIN_FAILURE_STATE
    }
  }

  /** One write, so the boolean is the whole truth: false means the failure was
   *  not recorded at all, which a caller that must not lose one has to act on. */
  public static async setPinFailureState(state: PinFailureState): Promise<boolean> {
    const written = await KeyStoreWrapper.migratedWrite(
      KeyStoreWrapper.PIN_FAILURE_STATE,
      JSON.stringify({ attempts: state.attempts, lockedUntil: state.lockedUntil }),
    )

    // The new key shadows the legacy one on read, so a failed erase here costs
    // nothing but a stale entry.
    if (written) await KeyStoreWrapper.migratedErase(KeyStoreWrapper.LEGACY_PIN_ATTEMPTS)

    return written
  }

  /**
   * Drops the state, falling back to writing a cleared value when the erase
   * fails: a failed erase leaves a spent attempt budget readable, and every
   * later wrong entry would then log the user out on the spot.
   *
   * False means neither worked. Callers let the user in anyway — they proved
   * the PIN — but should report it, since the state is now sticky.
   */
  public static async clearPinFailureState(): Promise<boolean> {
    const [erased, legacyErased] = await Promise.all([
      KeyStoreWrapper.migratedErase(KeyStoreWrapper.PIN_FAILURE_STATE),
      KeyStoreWrapper.migratedErase(KeyStoreWrapper.LEGACY_PIN_ATTEMPTS),
    ])

    if (erased && legacyErased) return true

    // An erase reports failure for a key that was never there too, so ask what
    // is actually still readable rather than writing on every clear.
    const remaining = await KeyStoreWrapper.getPinFailureState()
    if (remaining.status === "absent") return true
    if (
      remaining.status === "found" &&
      remaining.state.attempts === 0 &&
      remaining.state.lockedUntil === 0
    ) {
      return true
    }

    // Writing the cleared value also shadows a legacy key that would not erase.
    return KeyStoreWrapper.migratedWrite(
      KeyStoreWrapper.PIN_FAILURE_STATE,
      JSON.stringify(CLEARED_PIN_FAILURE_STATE),
    )
  }

  // ── session profiles ──────────────────────────────────────────────────────

  public static async saveSessionProfiles(profiles: ProfileProps[]): Promise<boolean> {
    try {
      return await KeyStoreWrapper.migratedWrite(
        KeyStoreWrapper.SESSION_PROFILES,
        JSON.stringify(profiles),
      )
    } catch {
      // JSON.stringify can throw on a circular value.
      return false
    }
  }

  /**
   * A missing key is a rejection, not an empty read, so "no profiles stored"
   * and "the keystore is unhappy" arrive the same way and only the error code
   * tells them apart — the same distinction readActiveToken draws. Callers that
   * write the list back must use this instead of getSessionProfiles: an empty
   * list scored from a failed read deletes every profile, and profiles carry
   * their sessions' tokens.
   *
   * Platform caveat: this only separates the two cases on Android — see the
   * note above KEY_NOT_FOUND_CODE.
   *
   * A payload that will not parse, or that parses to something other than an
   * array, is reported as absent rather than failed: it holds nothing a caller
   * could preserve, so refusing to overwrite it would protect no session while
   * permanently disabling multi-account — nothing else ever clears this key.
   * Reporting it absent lets the next login heal the slot.
   */
  public static async readSessionProfiles(): Promise<SessionProfilesRead> {
    const read = await KeyStoreWrapper.migratedReadWithStatus(
      KeyStoreWrapper.SESSION_PROFILES,
    )
    // An empty payload never reaches here: both stores report one as absent,
    // so a `found` always carries something to parse.
    if (read.status !== "found") return read

    try {
      const parsed = JSON.parse(read.value)
      return Array.isArray(parsed)
        ? { status: "found", profiles: parsed }
        : { status: "absent" }
    } catch {
      return { status: "absent" }
    }
  }

  /**
   * Collapses absent and failed to an empty list: convenient, and safe only
   * where that renders an empty list. Use readSessionProfiles where it leads
   * to a write.
   */
  public static async getSessionProfiles(): Promise<ProfileProps[]> {
    const read = await KeyStoreWrapper.readSessionProfiles()
    return read.status === "found" ? read.profiles : []
  }

  public static async removeSessionProfiles(): Promise<boolean> {
    return KeyStoreWrapper.migratedErase(KeyStoreWrapper.SESSION_PROFILES)
  }

  /**
   * A missing key is a rejection, not an empty read, on both platforms — so
   * "nothing stored" and "the keystore is unhappy" arrive the same way and only
   * the error code tells them apart. Callers that would destroy or overwrite a
   * credential based on an empty read must use this instead of getActiveToken.
   *
   * The code only tells them apart on Android — see the note above
   * KEY_NOT_FOUND_CODE. On iOS every failed read reports absent, so the failed
   * branch its callers take is unreachable there.
   */
  public static async readActiveToken(): Promise<ActiveTokenRead> {
    const read = await KeyStoreWrapper.migratedReadWithStatus(
      KeyStoreWrapper.ACTIVE_TOKEN,
    )
    if (read.status === "found") return { status: "found", token: read.value }
    return read
  }

  /**
   * Collapses absent and failed to "": convenient, and safe only where an empty
   * result leads to doing nothing. Use readActiveToken where it leads to a write.
   */
  public static async getActiveToken(): Promise<string> {
    const read = await KeyStoreWrapper.readActiveToken()
    return read.status === "found" ? read.token : ""
  }

  public static async setActiveToken(token: string): Promise<boolean> {
    return KeyStoreWrapper.migratedWrite(KeyStoreWrapper.ACTIVE_TOKEN, token)
  }

  public static async removeActiveToken(): Promise<boolean> {
    return KeyStoreWrapper.migratedErase(KeyStoreWrapper.ACTIVE_TOKEN)
  }

  /**
   * Reinstall guard: the iOS keychain outlives the app install, so a genuine
   * fresh install must clear every session credential the UI can reach.
   * Owning the list here means adding a new uninstall-surviving slot and
   * adding it to this wipe are the same edit, in the same file.
   *
   * Two consequences of the slots above moving stores, both deliberate and
   * neither free:
   *
   * 1. On iOS the legacy library's unscoped sweep deleted the app's own generic
   *    passwords, mnemonics included, on the first legacy call after a
   *    reinstall — which is what used to clear them, by accident rather than by
   *    decision, and only depending on which caller reached the library first.
   *    Now that every slot reads through the helper, that sweep never fires, so
   *    the mnemonics are removed here instead: same outcome, chosen rather than
   *    inherited (blinkbitcoin/blink-wip#1162).
   * 2. Adding the PIN and the biometrics flag widens a known false positive:
   *    the caller reaches this through `MigrationStatus.NoData`, which a
   *    throwing AsyncStorage read can produce without a reinstall, and the app
   *    lock now goes with the session. Taken deliberately — a real reinstall
   *    otherwise boots the next owner into a PIN nobody on the device chose,
   *    which is unrecoverable, while this costs a lock the user can set again
   *    on a boot that already signed them out loudly.
   *
   * Mnemonics are included, and reached through the account list stored beside
   * them — see MNEMONIC_ACCOUNTS. The keychain is never enumerated to find
   * them: on iOS `getAllGenericPasswordServices` returns the legacy library's
   * own service, and a reset on that service deletes every legacy item at once,
   * mnemonics among them. A fixed slot list plus a list we maintain ourselves is
   * what keeps that call out of this file.
   *
   * Each removal is retried once; a persistent failure is reported through
   * onFailure but never thrown, and never stops the remaining slots — boot
   * must go on and every slot must get its attempt.
   */
  public static async clearUninstallSurvivingCredentials(
    onFailure: (what: string) => void,
  ): Promise<void> {
    const removeWithRetry = async (remove: () => Promise<boolean>, what: string) => {
      // One immediate retry, no backoff: the failures worth a second attempt
      // here are one-shot keystore hiccups, and boot cannot wait out anything
      // longer-lived — the NoData branch re-runs this on the next launch.
      const ok = (await remove()) || (await remove())
      if (!ok) {
        onFailure(what)
      }
    }
    await removeWithRetry(KeyStoreWrapper.removeActiveToken, "active token")
    await removeWithRetry(KeyStoreWrapper.removeSessionProfiles, "session profiles")
    // The migrated slots are Keychain internet credentials, which outlive an
    // uninstall exactly as the legacy items did — and the app lock is the one
    // that strands its new owner, since a reinstall would boot into a PIN
    // nobody on this device ever chose.
    await removeWithRetry(KeyStoreWrapper.removePin, "pin")
    await removeWithRetry(KeyStoreWrapper.clearPinFailureState, "pin lockout state")
    await removeWithRetry(KeyStoreWrapper.removeIsBiometricsEnabled, "biometrics flag")

    // A list that cannot be read, or cannot be trusted, leaves the per-account
    // wipe with nothing to work from and says so. Treating either as empty
    // would report a clean wipe over key material this boot never looked at.
    const tracked = await KeyStoreWrapper.readMnemonicAccounts()
    if (tracked.status === "ok") {
      for (const accountId of tracked.accountIds) {
        await removeWithRetry(
          () => KeyStoreWrapper.deleteMnemonicForAccount(accountId),
          "mnemonic",
        )
      }
    } else {
      onFailure("mnemonic account list")
    }

    // Last, and whatever the list said. The list names only the accounts a
    // build that HAD it recorded, so an install predating it leaves mnemonics
    // no id here can reach — and the accidental sweep that used to clear them
    // is disarmed now that every slot reads through the helper. Erasing the
    // legacy store by service is what covers them, and it is a no-op once
    // there is nothing left in it (blinkbitcoin/blink-wip#1162).
    await removeWithRetry(eraseEntireLegacyStore, "legacy key store")
  }

  public static async removeSessionProfileByToken(token: string): Promise<boolean> {
    const read = await KeyStoreWrapper.readSessionProfiles()
    // Rewriting the list from a failed read would sign every other saved
    // account out; leaving this one entry behind is the lesser harm. The
    // logout caller ignores the result either way, so false is a report, not
    // a branch.
    if (read.status === "failed") return false
    // Nothing stored means nothing to remove — and no reason to write "[]".
    if (read.status === "absent") return true

    const remaining = read.profiles.filter((profile) => profile.token !== token)
    return KeyStoreWrapper.saveSessionProfiles(remaining)
  }

  // ── per-account mnemonic ──────────────────────────────────────────────────

  private static mnemonicKeyFor(accountId: string): string {
    return `${KeyStoreWrapper.MNEMONIC}:${accountId}`
  }

  private static mnemonicNetworkKeyFor(accountId: string): string {
    return `${KeyStoreWrapper.MNEMONIC_NETWORK}:${accountId}`
  }

  /**
   * The tracked account ids, or why they could not be produced.
   *
   * An absent slot is the only empty list this can report, and it is a real
   * one: `untrackMnemonicAccount` removes the slot with the last id rather than
   * storing `"[]"`, so nothing is stored precisely when nothing is tracked.
   * Every other shape that is not a list of ids is `malformed`, never an empty
   * list — see MnemonicAccountsRead for what collapsing them costs.
   *
   * Callers run inside the slot queue where they mutate; this read itself is
   * not queued, so that it can be called from within a queued task.
   */
  private static async readMnemonicAccounts(): Promise<MnemonicAccountsRead> {
    // Never read through: this slot is introduced with the new store, so the
    // legacy library cannot hold it, and asking would be one more call into the
    // library this migration exists to stop touching.
    const read = await secureRead(KeyStoreWrapper.MNEMONIC_ACCOUNTS)
    if (read.status === "absent") return { status: "ok", accountIds: [] }
    if (read.status === "failed") return { status: "failed" }

    try {
      const parsed: unknown = JSON.parse(read.value)
      if (!isAccountIdList(parsed)) return { status: "malformed" }
      return { status: "ok", accountIds: parsed }
    } catch {
      return { status: "malformed" }
    }
  }

  /**
   * Records an account whose mnemonic was already stored before this list
   * existed.
   *
   * Every upgrading install is in that position: its mnemonics arrive by
   * migration, not by a write, so nothing else would ever record them and the
   * reinstall wipe would have no account to reach. Called by the sweep, which
   * is what enumerates them.
   */
  public static async rememberMnemonicAccount(accountId: string): Promise<void> {
    return KeyStoreWrapper.trackMnemonicAccount(accountId)
  }

  /**
   * Records an account in the list the reinstall wipe reads.
   *
   * Tracking is best effort by design: the mnemonic write is what the caller
   * depends on, and failing that write is the only failure it should see. An id
   * that never made it here costs the wipe one slot on a reinstall, which is the
   * behaviour before this list existed, and the next write for that account
   * records it again. That is also why the queue's rejection is swallowed:
   * `setMnemonicForAccount` awaits this and must not start throwing.
   *
   * The read and the write are one turn in the slot queue. Split across two
   * turns they are not atomic, and a boot sweep recording one account while a
   * restore records another lands whichever write finishes last over the other,
   * dropping an id the wipe then never reaches.
   */
  private static async trackMnemonicAccount(accountId: string): Promise<void> {
    try {
      await onSlot(KeyStoreWrapper.MNEMONIC_ACCOUNTS, async () => {
        const tracked = await KeyStoreWrapper.readMnemonicAccounts()
        if (tracked.status === "failed") return

        // A list that will not parse is rewritten from scratch rather than left
        // alone: it holds no id anything can recover, and refusing to touch it
        // would retire tracking for every account written from here on.
        const accountIds = tracked.status === "ok" ? tracked.accountIds : []
        if (accountIds.includes(accountId)) return

        await secureWrite(
          KeyStoreWrapper.MNEMONIC_ACCOUNTS,
          JSON.stringify([...accountIds, accountId]),
          ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        )
      })
    } catch {
      // The queue rejects on timeout. Best effort, as above.
    }
  }

  /**
   * Drops an account from the list, but only once its mnemonic is provably
   * gone. Forgetting an id whose value survived would leave a mnemonic nothing
   * can reach, which is the one outcome this list exists to prevent.
   *
   * One turn in the slot queue, for the reason given above trackMnemonicAccount.
   */
  private static async untrackMnemonicAccount(accountId: string): Promise<void> {
    try {
      await onSlot(KeyStoreWrapper.MNEMONIC_ACCOUNTS, async () => {
        const tracked = await KeyStoreWrapper.readMnemonicAccounts()
        // A malformed list is left exactly as it is, unlike in the write above:
        // the ids still in it cannot be read out, so any rewrite here would
        // forget accounts whose mnemonics are still stored. The wipe reports it
        // instead, which is what gets it looked at.
        if (tracked.status !== "ok") return
        if (!tracked.accountIds.includes(accountId)) return

        const remaining = tracked.accountIds.filter((id) => id !== accountId)
        if (remaining.length > 0) {
          await secureWrite(
            KeyStoreWrapper.MNEMONIC_ACCOUNTS,
            JSON.stringify(remaining),
            ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          )
          return
        }

        // Removed rather than stored as "[]", so an absent slot keeps meaning
        // exactly "nothing is tracked" — see readMnemonicAccounts.
        await secureRemove(KeyStoreWrapper.MNEMONIC_ACCOUNTS)
      })
    } catch {
      // The queue rejects on timeout; the id stays tracked, which is the safe
      // side of this one — the next wipe simply reaches a mnemonic already gone.
    }
  }

  public static async getMnemonicForAccount(accountId: string): Promise<string | null> {
    const read = await KeyStoreWrapper.readMnemonicWithStatus(accountId)
    return read.status === "found" ? read.value : null
  }

  /** Keeps a failed read distinct from an account that has no mnemonic. */
  public static async readMnemonicWithStatus(
    accountId: string,
  ): Promise<SecureStoreRead> {
    return readThrough(
      KeyStoreWrapper.mnemonicSlotFor(KeyStoreWrapper.mnemonicKeyFor(accountId)),
    )
  }

  public static async setMnemonicForAccount(
    accountId: string,
    mnemonic: string,
  ): Promise<boolean> {
    const written = await writeThrough({
      slot: KeyStoreWrapper.mnemonicKeyFor(accountId),
      value: mnemonic,
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
    // Tracked only once the value it describes exists, so the wipe is never
    // pointed at a slot that was never written.
    if (written) await KeyStoreWrapper.trackMnemonicAccount(accountId)
    return written
  }

  public static async deleteMnemonicForAccount(accountId: string): Promise<boolean> {
    const removed = await removeThrough({
      slot: KeyStoreWrapper.mnemonicKeyFor(accountId),
      legacyKey: KeyStoreWrapper.mnemonicKeyFor(accountId),
    })
    // The network marker is derived data; failing to drop it is tolerated.
    await removeThrough({
      slot: KeyStoreWrapper.mnemonicNetworkKeyFor(accountId),
      legacyKey: KeyStoreWrapper.mnemonicNetworkKeyFor(accountId),
    })
    if (removed) await KeyStoreWrapper.untrackMnemonicAccount(accountId)
    return removed
  }

  public static async getMnemonicNetworkForAccount(
    accountId: string,
  ): Promise<string | null> {
    const read = await readThrough(
      KeyStoreWrapper.mnemonicSlotFor(KeyStoreWrapper.mnemonicNetworkKeyFor(accountId)),
    )
    return read.status === "found" ? read.value : null
  }

  public static async setMnemonicNetworkForAccount(
    accountId: string,
    network: string,
  ): Promise<boolean> {
    return writeThrough({
      slot: KeyStoreWrapper.mnemonicNetworkKeyFor(accountId),
      value: network,
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  }

  /**
   * Finishes a slot's migration and then erases its legacy copy, in that order.
   *
   * Erasing first is what the obvious implementation does and it is wrong. A
   * read-through reports `found` for a value it read out of the legacy store
   * even when the migrating write failed, so "this slot has been read" is not
   * evidence the new store holds anything. Erasing on that evidence deletes the
   * only copy — a re-login for a session slot, and someone's seed for a
   * mnemonic.
   *
   * So the new store has to say `found` itself before anything is deleted, and
   * every step runs inside the slot queue: a read-through migrating this same
   * slot concurrently sits between its own miss and its legacy read, and an
   * unqueued erase in that window takes the value out from under it.
   *
   * False whenever the copy is not provably safe to remove, which simply leaves
   * it for the next boot. Never rejects, like every other operation on this
   * queue: a slot that timed out must cost its own key and not the ones behind
   * it, which a rejection propagating out of the loop would.
   */
  private static async purgeSlot(
    args: ReadThroughArgs,
    requireMigrated: boolean,
  ): Promise<boolean> {
    // Migrates as its side effect, and takes its own turn in the queue. A slot
    // nothing has read yet is unmigrated by definition, and this is the last
    // chance it gets before its legacy copy is gone.
    await readThrough(args)

    try {
      return await onSlot(args.slot, async (isCurrent) => {
        const migratedFirst = await secureRead(args.slot)

        const legacy = await legacyRead(args.legacyKey)
        if (legacy.status === "failed") return false

        // `absent` is not the proof it looks like on iOS: the native module
        // discards the OSStatus and rejects every failed lookup with the
        // not-found code, so a read taken before first unlock reports an empty
        // store rather than an unreadable one. Believing it is what would let a
        // silent-push launch record the purge as done over a mnemonic that
        // never left the legacy store.
        //
        // Where getting it wrong costs a re-login, absence is accepted: a user
        // who never set a PIN has nothing here and must not be retried forever.
        // Where it costs a seed, the new store has to hold the value first.
        if (legacy.status === "absent") {
          return requireMigrated ? migratedFirst.status === "found" : true
        }

        // The only status that proves the value survived the move. `absent`
        // means the migrating write failed, `failed` means the store could not
        // say. Re-read, because the read-through above may have migrated it
        // since.
        const migrated = await secureRead(args.slot)
        if (migrated.status !== "found") return false

        if (!isCurrent()) return false

        return eraseLegacyCopy(args.legacyKey)
      })
    } catch {
      return false
    }
  }

  /**
   * Erases every item this app ever wrote to the legacy key store, by name.
   *
   * The migration moves a slot the first time something reads it, so a value
   * nothing reads is still sitting in the legacy store; and the mnemonic slots
   * keep their legacy copy deliberately, so those are there even after they
   * migrate (see mnemonicSlotFor). This is what finally removes both, and it is
   * the only thing that does: dropping the dependency deletes no data, it just
   * removes the code that could have.
   *
   * By name rather than by service, unlike eraseEntireLegacyStore: a named
   * delete is the half that also works on Android, where the legacy store is a
   * shared-preferences file rather than a Keychain service.
   *
   * `accountIds` comes from the caller because the account index lives in
   * AsyncStorage, outside this file. An id missing from that list leaves its
   * mnemonic behind, which is the conservative direction: the key stays until a
   * boot that can name it.
   *
   * True only when every key is provably gone, so that a caller recording this
   * as done cannot record it over a store that still holds something.
   */
  public static async purgeLegacyKeyStore(accountIds: string[]): Promise<boolean> {
    // What an empty legacy read is allowed to mean, carried per slot rather than
    // derived from the key name: only the seed is held to the strict rule.
    // Session slots may legitimately have never existed, and the network marker
    // is optional metadata, so demanding proof of either would leave the purge
    // unable to finish and retrying every boot forever.
    const sessionSlots = [
      KeyStoreWrapper.IS_BIOMETRICS_ENABLED,
      KeyStoreWrapper.PIN,
      KeyStoreWrapper.PIN_FAILURE_STATE,
      KeyStoreWrapper.LEGACY_PIN_ATTEMPTS,
      KeyStoreWrapper.SESSION_PROFILES,
      KeyStoreWrapper.ACTIVE_TOKEN,
    ].map((key) => ({ args: KeyStoreWrapper.slotFor(key), requireMigrated: false }))

    const mnemonicSlots = accountIds.flatMap((accountId) => [
      {
        args: KeyStoreWrapper.mnemonicSlotFor(KeyStoreWrapper.mnemonicKeyFor(accountId)),
        requireMigrated: true,
      },
      {
        args: KeyStoreWrapper.mnemonicSlotFor(
          KeyStoreWrapper.mnemonicNetworkKeyFor(accountId),
        ),
        requireMigrated: false,
      },
    ])

    let allGone = true
    for (const slot of [...sessionSlots, ...mnemonicSlots]) {
      // Sequential, and never short-circuited: one slot that cannot be purged
      // must not leave the rest behind for a purge that may not run again for
      // months.
      const gone = await KeyStoreWrapper.purgeSlot(slot.args, slot.requireMigrated)
      if (!gone) allGone = false
    }

    return allGone
  }
}
