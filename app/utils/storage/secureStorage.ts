import { ACCESSIBLE } from "react-native-keychain"
import RNSecureKeyStore, {
  ACCESSIBLE as LEGACY_ACCESSIBLE,
} from "react-native-secure-key-store"

import { type SecureExists } from "./secure-store"
import {
  type ReadThroughArgs,
  existsThrough,
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

// Both native modules reject a missing key with code "404" (ios/RNSecureKeyStore.m
// `get`, android RNSecureKeyStoreModule#get). Every other code means the read
// itself went wrong.
//
// True on Android only. The iOS module discards the OSStatus from
// SecItemCopyMatching (`searchKeychainCopyMatching` returns nil for any failure)
// and `get` rejects nil with "404", so an entitlement or decode error is
// indistinguishable from a missing key there. Every caller that branches on this
// therefore degrades to "absent" on iOS; the distinction becomes real when the
// slots move to react-native-keychain (blink-wip#1161).
const KEY_NOT_FOUND_CODE = "404"

const isKeyNotFound = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  String((err as { code: unknown }).code) === KEY_NOT_FOUND_CODE

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
   * The slots that have moved to the Keychain-backed store
   * (blinkbitcoin/blink-wip#1161). Each carries the protection class its value
   * is written under and whether a migrated legacy copy is erased. Mnemonics
   * are deliberately absent: they move in blinkbitcoin/blink-wip#1162.
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

  // ── legacy-only primitives ────────────────────────────────────────────────
  // Still backed by react-native-secure-key-store, and used only by the slots
  // that have not moved yet. `accessible` is always passed explicitly and never
  // defaulted: a default would let a new method silently downgrade the
  // protection class of whatever it stores.

  private static async write(
    key: string,
    value: string,
    accessible: LEGACY_ACCESSIBLE,
  ): Promise<boolean> {
    try {
      await RNSecureKeyStore.set(key, value, { accessible })
      return true
    } catch {
      return false
    }
  }

  private static async erase(key: string): Promise<boolean> {
    try {
      await RNSecureKeyStore.remove(key)
      return true
    } catch {
      return false
    }
  }

  private static async readWithStatus(key: string): Promise<SecureStoreRead> {
    try {
      return { status: "found", value: await RNSecureKeyStore.get(key) }
    } catch (err) {
      return isKeyNotFound(err) ? { status: "absent" } : { status: "failed", err }
    }
  }

  /** Collapses absent and failed for callers where either means do nothing. */
  private static async read(key: string): Promise<string | null> {
    const read = await KeyStoreWrapper.readWithStatus(key)
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
   * 1. On iOS the legacy library's unscoped sweep used to delete the app's own
   *    generic passwords, mnemonics included, on the first legacy call after a
   *    reinstall. The read-through helper disarms that sweep before every
   *    legacy touch, so mnemonics now survive an uninstall for the first time.
   *    That is the product decision recorded in blinkbitcoin/blink-wip#1143
   *    (finding 2) and it blocks blinkbitcoin/blink-wip#1162; it arrives here
   *    ahead of that answer and nothing in this file can defer it.
   * 2. Adding the PIN and the biometrics flag widens a known false positive:
   *    the caller reaches this through `MigrationStatus.NoData`, which a
   *    throwing AsyncStorage read can produce without a reinstall, and the app
   *    lock now goes with the session. Taken deliberately — a real reinstall
   *    otherwise boots the next owner into a PIN nobody on the device chose,
   *    which is unrecoverable, while this costs a lock the user can set again
   *    on a boot that already signed them out loudly.
   *
   * Mnemonics are deliberately excluded: wallet keys outliving uninstall is a
   * recovery/product decision, not cleanup (and their account index does not
   * survive uninstall, so they cannot be enumerated here anyway).
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

  public static async getMnemonicForAccount(accountId: string): Promise<string | null> {
    return KeyStoreWrapper.read(KeyStoreWrapper.mnemonicKeyFor(accountId))
  }

  public static async setMnemonicForAccount(
    accountId: string,
    mnemonic: string,
  ): Promise<boolean> {
    return KeyStoreWrapper.write(
      KeyStoreWrapper.mnemonicKeyFor(accountId),
      mnemonic,
      LEGACY_ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    )
  }

  public static async deleteMnemonicForAccount(accountId: string): Promise<boolean> {
    const removed = await KeyStoreWrapper.erase(KeyStoreWrapper.mnemonicKeyFor(accountId))
    // The network marker is derived data; failing to drop it is tolerated.
    await KeyStoreWrapper.erase(KeyStoreWrapper.mnemonicNetworkKeyFor(accountId))
    return removed
  }

  public static async getMnemonicNetworkForAccount(
    accountId: string,
  ): Promise<string | null> {
    return KeyStoreWrapper.read(KeyStoreWrapper.mnemonicNetworkKeyFor(accountId))
  }

  public static async setMnemonicNetworkForAccount(
    accountId: string,
    network: string,
  ): Promise<boolean> {
    return KeyStoreWrapper.write(
      KeyStoreWrapper.mnemonicNetworkKeyFor(accountId),
      network,
      LEGACY_ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    )
  }
}
