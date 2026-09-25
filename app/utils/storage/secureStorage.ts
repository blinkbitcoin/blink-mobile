import { ACCESSIBLE } from "react-native-keychain"

import { recordAppError } from "@app/utils/error-reporting"

import { eraseEntireLegacyStore } from "./legacy-key-store"
import {
  type SecureExists,
  secureExists,
  secureRead,
  secureRemove,
  secureWrite,
} from "./secure-store"
import {
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
 * What the tracked account list holds, or that it could not be read.
 *
 * Two answers rather than three, because the stored format cannot be damaged as
 * a whole. `failed` read as `ok` with no ids would make the next write drop
 * every id already tracked, so those stay apart — but "read it and it was
 * garbage" is no longer a state callers branch on. It used to be, and it used
 * to be permanent: the only repair rebuilt the list from the account index, and
 * a reinstall clears that index before the wipe ever runs.
 */
type MnemonicAccountsRead =
  | { readonly status: "ok"; readonly accountIds: readonly string[] }
  /**
   * `cause` is not a third status in disguise: every caller still branches on
   * `failed` alone. It exists because the two failures have opposite lifetimes
   * and only the report can say which one is on the device — a read that failed
   * clears itself on the next boot, while a value that cannot be read never
   * does, and one label for both leaves an eternal report looking transient.
   */
  | { readonly status: "failed"; readonly cause: MnemonicAccountsFailure }

const MnemonicAccountsFailure = {
  /** The keystore could not answer; the value itself may be fine. */
  Read: "read",
  /** It answered, and what it holds is not a list of ids. */
  UnreadableValue: "unreadable-value",
} as const

type MnemonicAccountsFailure =
  (typeof MnemonicAccountsFailure)[keyof typeof MnemonicAccountsFailure]

/**
 * The tracked list as earlier builds of this branch wrote it — see
 * readMnemonicAccounts for why both shapes are read.
 *
 * An array that will not parse, or that holds anything but strings, is
 * reported as unreadable rather than salvaged line by line: those lines are
 * not account ids, and reading them as such would tell the wipe it had
 * finished while every real mnemonic stayed on the device. "Failed" is the
 * honest answer, and it is the one that keeps the wipe owed.
 */
const parseLegacyAccountIdArray = (raw: string): MnemonicAccountsRead => {
  const unreadable: MnemonicAccountsRead = {
    status: "failed",
    cause: MnemonicAccountsFailure.UnreadableValue,
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return unreadable
    if (!parsed.every((id) => typeof id === "string")) return unreadable
    return { status: "ok", accountIds: parsed.filter((id) => id.length > 0) }
  } catch {
    return unreadable
  }
}

/**
 * One immediate retry, no backoff, reporting the slot by name on a second
 * failure. Both halves of the reinstall wipe use it, so the policy is stated
 * once: the failures worth a second attempt are one-shot keystore hiccups, and
 * boot cannot wait out anything longer-lived — the fresh-install branch re-runs
 * the wipe on the next launch. A failure is reported, never thrown, and never
 * stops the slots behind it.
 */
const retryOnce = async (remove: () => Promise<boolean>): Promise<boolean> => {
  if (await remove()) return true
  return remove()
}

const withOneRetry =
  (onFailure: (what: string) => void) =>
  async (remove: () => Promise<boolean>, what: string): Promise<boolean> => {
    const ok = await retryOnce(remove)
    if (!ok) onFailure(what)
    return ok
  }

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
   * fresh install must clear every session credential the UI can reach. The
   * list lives here so that adding an uninstall-surviving slot and wiping it
   * are one edit in one file.
   *
   * **Session credentials only, and unconditional.** This half runs on every
   * fresh-install verdict because being wrong about it costs a re-login. The
   * key material is the other half and waits for a second witness, because being
   * wrong about that costs someone their money. Keeping the two apart is the
   * safety property of this design: do not move a mnemonic slot into this list,
   * and do not read the gate on the other half as redundant
   * (blinkbitcoin/blink-wip#1162).
   *
   * The PIN and the biometrics flag are here despite a known false positive:
   * `MigrationStatus.NoData` can arrive without a reinstall. Deliberate, because
   * a real reinstall otherwise boots the next owner into a PIN nobody on the
   * device chose, which is unrecoverable, against a lock the user can set again.
   */
  public static async clearUninstallSurvivingCredentials(
    onFailure: (what: string) => void,
  ): Promise<void> {
    const removeWithRetry = withOneRetry(onFailure)

    await removeWithRetry(KeyStoreWrapper.removeActiveToken, "active token")
    await removeWithRetry(KeyStoreWrapper.removeSessionProfiles, "session profiles")
    // The migrated slots are Keychain internet credentials, which outlive an
    // uninstall exactly as the legacy items did — and the app lock is the one
    // that strands its new owner, since a reinstall would boot into a PIN
    // nobody on this device ever chose.
    await removeWithRetry(KeyStoreWrapper.removePin, "pin")
    // Erased rather than cleared: `clearPinFailureState` falls back to writing a
    // zeroed value when both erases fail, which is right for its own caller but
    // would let a wipe finish by creating an entry that then outlives the *next*
    // uninstall. Both keys, because that is what the cleared path covers.
    await removeWithRetry(
      () => KeyStoreWrapper.migratedErase(KeyStoreWrapper.PIN_FAILURE_STATE),
      "pin lockout state",
    )
    await removeWithRetry(
      () => KeyStoreWrapper.migratedErase(KeyStoreWrapper.LEGACY_PIN_ATTEMPTS),
      "legacy pin attempts",
    )
    await removeWithRetry(KeyStoreWrapper.removeIsBiometricsEnabled, "biometrics flag")
  }

  /**
   * Clears the legacy store by service, which the caller runs before either half
   * of the wipe.
   *
   * Two jobs. It is the only thing that reaches mnemonics no id can name: the
   * tracked list records accounts only from a build that had it, so an install
   * predating it leaves seeds no enumeration here covers, and erasing by service
   * covers them. And it unblocks everything that follows, because
   * `removeThrough` refuses to empty the new store until the legacy copy is
   * provably gone — a legacy store that cannot answer otherwise fails every slot
   * that goes through it, session credentials included.
   *
   * A no-op once there is nothing left in it (blinkbitcoin/blink-wip#1162), and
   * if it fails both halves behave exactly as they did before.
   */
  public static async clearLegacyKeyStore(
    onFailure: (what: string) => void,
  ): Promise<void> {
    await withOneRetry(onFailure)(eraseEntireLegacyStore, "legacy key store")
  }

  /**
   * The other half of the reinstall wipe: the key material, which is the part
   * that cannot be re-issued.
   *
   * Separate from the session credentials above because the caller must be able
   * to run one without the other. The fresh-install verdict is a heuristic, and
   * getting it wrong costs a re-login on one side and someone's money on this
   * one, so this half waits for evidence the other half does not need — see
   * handleFreshInstall.
   *
   * **`clearLegacyKeyStore` must have run first**, which the caller owns rather
   * than this method, because the session half needs it too. Skipping it leaves
   * both of the things that method exists for undone — see its docblock.
   */
  public static async clearUninstallSurvivingKeyMaterial(
    onFailure: (what: string) => void,
  ): Promise<void> {
    // A list that cannot be read, or cannot be trusted, leaves the per-account
    // wipe with nothing to work from and says so. Treating either as empty
    // would report a clean wipe over key material this boot never looked at.
    const tracked = await KeyStoreWrapper.readMnemonicAccounts()
    if (tracked.status !== "ok") {
      // Named apart because they end differently: one is worth waiting a boot
      // for, the other will report forever until someone looks at the device.
      const isUnreadableValue = tracked.cause === MnemonicAccountsFailure.UnreadableValue
      const label = isUnreadableValue
        ? "mnemonic account list (unreadable value)"
        : "mnemonic account list"
      onFailure(label)
      return
    }

    // Counted, then reported once with the share left behind. One label per
    // account says nothing about how much of the device was missed, and N
    // identical entries are worse than one that carries the number — the sweep
    // reports its own failures the same way, for the same reason.
    let failed = 0
    for (const accountId of tracked.accountIds) {
      // Retried without reporting: the per-account label is the repetition this
      // aggregate replaces.
      const removed = await retryOnce(() =>
        KeyStoreWrapper.deleteMnemonicForAccount(accountId),
      )
      if (!removed) failed += 1
    }
    if (failed > 0) onFailure(`mnemonic (${failed}/${tracked.accountIds.length})`)
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
   * The tracked account ids, or that they could not be read.
   *
   * **One id per line, not JSON**, because a parser that can reject the whole
   * value gives damage an all-or-nothing cost: one truncated byte skipped the
   * wipe entirely, and no repair could help, since the only one rebuilt from
   * the account index that a reinstall has just cleared. Per line, damage costs
   * at most the ids on the line it touched. Ids are UUIDs, so no newline needs
   * escaping.
   *
   * Two ways to hold no ids, both real: an absent slot, because
   * `untrackMnemonicAccount` removes the slot rather than storing an empty
   * value, and a value of only blank lines.
   *
   * Not queued, so it can be called from within a queued task; callers take
   * their turn where they mutate.
   */
  private static async readMnemonicAccounts(): Promise<MnemonicAccountsRead> {
    // Never read through: this slot is introduced with the new store, so the
    // legacy library cannot hold it, and asking would be one more call into the
    // library this migration exists to stop touching.
    const read = await secureRead(KeyStoreWrapper.MNEMONIC_ACCOUNTS)
    if (read.status === "absent") return { status: "ok", accountIds: [] }
    if (read.status === "failed") {
      return { status: "failed", cause: MnemonicAccountsFailure.Read }
    }

    const raw = read.value.trim()
    // Earlier builds of this branch wrote the list as a JSON array. No release
    // carries one, so this is not a migration owed to any user — but a device
    // that ran one of those builds still holds it, and split by line an array
    // reads as a single id that matches no account: the wipe would report
    // success having touched none of that device's mnemonics. Both shapes are
    // accepted for one release rather than leaving those seeds behind.
    if (raw.startsWith("[")) return parseLegacyAccountIdArray(raw)

    const accountIds = raw
      .split("\n")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
    return { status: "ok", accountIds }
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
  public static async rememberMnemonicAccount(accountId: string): Promise<boolean> {
    return KeyStoreWrapper.trackMnemonicAccount(accountId)
  }

  /**
   * Records an account in the list the reinstall wipe reads.
   *
   * An id that never reaches this list is not benign: the list is now the only
   * thing that names a migrated mnemonic, so an untracked one survives the wipe
   * until something records it again. Hence the boolean, which is what lets
   * `setMnemonicForAccount` report a mnemonic it stored but could not name; a
   * queue rejection is swallowed rather than thrown, because this runs before
   * the write the caller actually depends on.
   *
   * The read and the write are one turn in the slot queue. Split in two they
   * are not atomic, and a boot sweep recording one account while a restore
   * records another lands whichever finishes last over the other.
   */
  private static async trackMnemonicAccount(accountId: string): Promise<boolean> {
    try {
      return await onSlot(KeyStoreWrapper.MNEMONIC_ACCOUNTS, async (isCurrent) => {
        const tracked = await KeyStoreWrapper.readMnemonicAccounts()
        if (tracked.status === "failed") return false

        const accountIds = tracked.accountIds
        if (accountIds.includes(accountId)) return true
        // A snapshot written after this task was abandoned lands over the turn
        // that replaced it, dropping whatever that turn recorded.
        if (!isCurrent()) return false

        const written = await secureWrite(
          KeyStoreWrapper.MNEMONIC_ACCOUNTS,
          [...accountIds, accountId].join("\n"),
          ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        )

        return written
      })
    } catch {
      // The queue rejects on timeout. Best effort, as above.
      return false
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
      await onSlot(KeyStoreWrapper.MNEMONIC_ACCOUNTS, async (isCurrent) => {
        const tracked = await KeyStoreWrapper.readMnemonicAccounts()
        // A list that cannot be read is left exactly as it is: the ids still in
        // it cannot be read out, so any rewrite here would forget accounts
        // whose mnemonics are still stored. The wipe reports it instead, which
        // is what gets it looked at.
        if (tracked.status !== "ok") return
        if (!tracked.accountIds.includes(accountId)) return

        // Same guard as the writes above: forgetting an id on an abandoned turn
        // leaves a mnemonic nothing can reach.
        if (!isCurrent()) return

        const remaining = tracked.accountIds.filter((id) => id !== accountId)
        if (remaining.length > 0) {
          await secureWrite(
            KeyStoreWrapper.MNEMONIC_ACCOUNTS,
            remaining.join("\n"),
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
    // Tracked before the value is written, so the list is a superset of what is
    // stored rather than a subset. That is the safe direction of the two: a
    // spurious id costs the reinstall wipe one no-op delete, and
    // deleteMnemonicForAccount already untracks ids whose value is gone, so it
    // clears itself. A missing id costs a mnemonic the wipe cannot reach at all.
    const tracked = await KeyStoreWrapper.trackMnemonicAccount(accountId)

    const written = await writeThrough({
      slot: KeyStoreWrapper.mnemonicKeyFor(accountId),
      value: mnemonic,
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })

    // Reported even though the caller is told the write succeeded, because it
    // did: the seed is stored and the wipe has no way to name it. The boot sweep
    // re-records it, and this is what says the sweep has something to do.
    if (written && !tracked) {
      try {
        recordAppError(new Error("Mnemonic stored but not tracked"), {
          dedupKey: "storage-mnemonic-untracked",
        })
      } catch {
        // The firebase handle is not guaranteed to be initialised, and this call
        // sits after the write the caller depends on. Letting it reject would
        // make a stored mnemonic look like a failed one, and the rollback in
        // lifecycle.ts runs on that answer.
      }
    }

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
    const read = await KeyStoreWrapper.readMnemonicNetworkWithStatus(accountId)
    return read.status === "found" ? read.value : null
  }

  /**
   * Whether the mnemonic is present, without decrypting it.
   *
   * The boot sweep asks this instead of reading. A read answers by putting the
   * phrase in a JS string, which cannot be zeroed, for every indexed account on
   * every launch — including the ones the user never opens. This answers from
   * the new store through `hasInternetCredentials`, which needs no decryption
   * and works before the first unlock, and falls through to the migrating read
   * only when the new store has nothing, which is the case that has to move.
   *
   * `yes` therefore means "in the new store", which is what "migrated" has to
   * mean for the release that drops the legacy one.
   */
  public static async mnemonicExists(accountId: string): Promise<SecureExists> {
    return existsThrough(
      KeyStoreWrapper.mnemonicSlotFor(KeyStoreWrapper.mnemonicKeyFor(accountId)),
    )
  }

  /**
   * Whether the mnemonic is in the NEW store, with no migrating fallback.
   *
   * `mnemonicExists` answers yes for a value it found in the legacy store even
   * when the write meant to move it failed, because migration bookkeeping must
   * never cost availability. That makes it the wrong question for the sweep's
   * count: "found" is not "moved", and the release that drops the legacy store
   * is gated on knowing the difference.
   *
   * The one read on this slot that does not take its turn in the queue. Nothing
   * but a count depends on the answer, and racing a write means counting the
   * account on the next boot instead of this one; queueing it would serialise a
   * probe behind the very writes it is only observing.
   */
  public static async mnemonicIsMigrated(accountId: string): Promise<SecureExists> {
    return secureExists(KeyStoreWrapper.mnemonicKeyFor(accountId))
  }

  /** The network marker's counterpart to mnemonicExists, for the same reason. */
  public static async mnemonicNetworkExists(accountId: string): Promise<SecureExists> {
    return existsThrough(
      KeyStoreWrapper.mnemonicSlotFor(KeyStoreWrapper.mnemonicNetworkKeyFor(accountId)),
    )
  }

  /**
   * Keeps a failed read distinct from an account that was never tagged with a
   * network, for callers that must not connect a wallet they could not verify.
   */
  public static async readMnemonicNetworkWithStatus(
    accountId: string,
  ): Promise<SecureStoreRead> {
    return readThrough(
      KeyStoreWrapper.mnemonicSlotFor(KeyStoreWrapper.mnemonicNetworkKeyFor(accountId)),
    )
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
}
