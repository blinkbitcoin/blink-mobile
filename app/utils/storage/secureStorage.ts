import RNSecureKeyStore, { ACCESSIBLE } from "react-native-secure-key-store"

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

// Both native modules reject a missing key with code "404" (ios/RNSecureKeyStore.m
// `get`, android RNSecureKeyStoreModule#get). Every other code means the read
// itself went wrong.
const KEY_NOT_FOUND_CODE = "404"

const isKeyNotFound = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  String((err as { code: unknown }).code) === KEY_NOT_FOUND_CODE

/**
 * The two keys behind the PIN lockout. They are only ever read, written and
 * cleared together — see the paired API at the bottom of this class.
 */
export type PinFailureState = {
  /** Consecutive wrong-PIN entries. */
  attempts: number
  /** Epoch ms the lock lifts at; 0 when no lock is in force. */
  lockedUntil: number
}

export default class KeyStoreWrapper {
  private static readonly IS_BIOMETRICS_ENABLED = "isBiometricsEnabled"
  private static readonly PIN = "PIN"
  private static readonly PIN_ATTEMPTS = "pinAttempts"
  private static readonly PIN_LOCKED_UNTIL = "pinLockedUntil"
  private static readonly SESSION_PROFILES = "sessionProfiles"
  private static readonly ACTIVE_TOKEN = GALOY_AUTH_TOKEN_KEY
  private static readonly MNEMONIC = "mnemonic"
  private static readonly MNEMONIC_NETWORK = "mnemonic_network"

  // ── keystore primitives ───────────────────────────────────────────────────
  // Every method below is one of these four shapes. `accessible` is always
  // passed explicitly and never defaulted: a default would let a new method
  // silently downgrade the protection class of whatever it stores.

  private static async write(
    key: string,
    value: string,
    accessible: ACCESSIBLE,
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

  /** The keystore rejects for a missing key, so a successful read is presence. */
  private static async has(key: string): Promise<boolean> {
    try {
      await RNSecureKeyStore.get(key)
      return true
    } catch {
      return false
    }
  }

  /** `null` for a missing key and for a failed read — the two are not
   *  distinguishable through this library on either platform. */
  private static async read(key: string): Promise<string | null> {
    try {
      return await RNSecureKeyStore.get(key)
    } catch {
      return null
    }
  }

  /** Missing, empty and unparseable all collapse to `fallback`, so a corrupt
   *  entry can never leak a NaN into a comparison. */
  private static async readNumber(key: string, fallback: number): Promise<number> {
    const raw = await KeyStoreWrapper.read(key)
    if (raw === null) return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  // ── biometrics ────────────────────────────────────────────────────────────

  public static async getIsBiometricsEnabled(): Promise<boolean> {
    return KeyStoreWrapper.has(KeyStoreWrapper.IS_BIOMETRICS_ENABLED)
  }

  public static async setIsBiometricsEnabled(): Promise<boolean> {
    return KeyStoreWrapper.write(
      KeyStoreWrapper.IS_BIOMETRICS_ENABLED,
      "1",
      ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
    )
  }

  public static async removeIsBiometricsEnabled(): Promise<boolean> {
    return KeyStoreWrapper.erase(KeyStoreWrapper.IS_BIOMETRICS_ENABLED)
  }

  // ── the PIN itself ────────────────────────────────────────────────────────

  public static async getIsPinEnabled(): Promise<boolean> {
    return KeyStoreWrapper.has(KeyStoreWrapper.PIN)
  }

  public static async getPinOrEmptyString(): Promise<string> {
    return (await KeyStoreWrapper.read(KeyStoreWrapper.PIN)) ?? ""
  }

  public static async setPin(pin: string): Promise<boolean> {
    return KeyStoreWrapper.write(
      KeyStoreWrapper.PIN,
      pin,
      ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
    )
  }

  public static async removePin(): Promise<boolean> {
    return KeyStoreWrapper.erase(KeyStoreWrapper.PIN)
  }

  // ── PIN lockout ───────────────────────────────────────────────────────────
  // The attempt count and the lock expiry are one logical value split across
  // two keys. Clearing one without the other locks out a user who has already
  // proven who they are, so the single-key accessors are private and the only
  // way in is the paired API below.

  private static async getPinAttemptsOrZero(): Promise<number> {
    return KeyStoreWrapper.readNumber(KeyStoreWrapper.PIN_ATTEMPTS, 0)
  }

  private static async setPinAttempts(attempts: number): Promise<boolean> {
    return KeyStoreWrapper.write(
      KeyStoreWrapper.PIN_ATTEMPTS,
      String(attempts),
      ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
    )
  }

  private static async removePinAttempts(): Promise<boolean> {
    return KeyStoreWrapper.erase(KeyStoreWrapper.PIN_ATTEMPTS)
  }

  private static async getPinLockedUntilOrZero(): Promise<number> {
    return KeyStoreWrapper.readNumber(KeyStoreWrapper.PIN_LOCKED_UNTIL, 0)
  }

  private static async setPinLockedUntil(epochMs: number): Promise<boolean> {
    return KeyStoreWrapper.write(
      KeyStoreWrapper.PIN_LOCKED_UNTIL,
      String(epochMs),
      ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
    )
  }

  private static async removePinLockedUntil(): Promise<boolean> {
    return KeyStoreWrapper.erase(KeyStoreWrapper.PIN_LOCKED_UNTIL)
  }

  public static async getPinFailureState(): Promise<PinFailureState> {
    const [attempts, lockedUntil] = await Promise.all([
      KeyStoreWrapper.getPinAttemptsOrZero(),
      KeyStoreWrapper.getPinLockedUntilOrZero(),
    ])
    return { attempts, lockedUntil }
  }

  /** False if either half failed to land — a caller that must not lose a
   *  failed attempt has to check this. */
  public static async setPinFailureState({
    attempts,
    lockedUntil,
  }: PinFailureState): Promise<boolean> {
    const written = await Promise.all([
      KeyStoreWrapper.setPinAttempts(attempts),
      KeyStoreWrapper.setPinLockedUntil(lockedUntil),
    ])
    return written.every(Boolean)
  }

  /** Drops both keys. A key that was already absent is the cleared state, so
   *  there is no failure here a caller could act on. */
  public static async clearPinFailureState(): Promise<void> {
    await Promise.all([
      KeyStoreWrapper.removePinAttempts(),
      KeyStoreWrapper.removePinLockedUntil(),
    ])
  }

  /** Persists only the lock, leaving the attempt count alone. Used to repair a
   *  stored lock that outran the schedule; it can only ever shorten one. */
  public static async repairPinLockedUntil(epochMs: number): Promise<boolean> {
    return KeyStoreWrapper.setPinLockedUntil(epochMs)
  }

  // ── session profiles ──────────────────────────────────────────────────────

  public static async saveSessionProfiles(profiles: ProfileProps[]): Promise<boolean> {
    try {
      return await KeyStoreWrapper.write(
        KeyStoreWrapper.SESSION_PROFILES,
        JSON.stringify(profiles),
        ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
      )
    } catch {
      // JSON.stringify can throw on a circular value.
      return false
    }
  }

  public static async getSessionProfiles(): Promise<ProfileProps[]> {
    const data = await KeyStoreWrapper.read(KeyStoreWrapper.SESSION_PROFILES)
    if (!data) return []
    try {
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  public static async removeSessionProfiles(): Promise<boolean> {
    return KeyStoreWrapper.erase(KeyStoreWrapper.SESSION_PROFILES)
  }

  /**
   * A missing key is a rejection, not an empty read, on both platforms — so
   * "nothing stored" and "the keystore is unhappy" arrive the same way and only
   * the error code tells them apart. Callers that would destroy or overwrite a
   * credential based on an empty read must use this instead of getActiveToken.
   */
  public static async readActiveToken(): Promise<ActiveTokenRead> {
    try {
      const token = await RNSecureKeyStore.get(KeyStoreWrapper.ACTIVE_TOKEN)
      return token ? { status: "found", token } : { status: "absent" }
    } catch (err) {
      // "404" is the one code both the iOS and Android modules reserve for a
      // key that is not there; anything else (locked keystore, decrypt error,
      // unknown) is a failed read and must not be read as "no token".
      return isKeyNotFound(err) ? { status: "absent" } : { status: "failed", err }
    }
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
    try {
      // ALWAYS_THIS_DEVICE_ONLY over WHEN_UNLOCKED: iOS can cold-start the app in the
      // background while locked (UIBackgroundModes remote-notification), and a failed
      // read here degrades to a silent logged-out session.
      await RNSecureKeyStore.set(KeyStoreWrapper.ACTIVE_TOKEN, token, {
        accessible: ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
      })
      return true
    } catch {
      return false
    }
  }

  public static async removeActiveToken(): Promise<boolean> {
    try {
      await RNSecureKeyStore.remove(KeyStoreWrapper.ACTIVE_TOKEN)
      return true
    } catch {
      return false
    }
  }

  /**
   * Reinstall guard: the iOS keychain outlives the app install, so a genuine
   * fresh install must clear every session credential the UI can reach.
   * Owning the list here means adding a new uninstall-surviving slot and
   * adding it to this wipe are the same edit, in the same file.
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
  }

  public static async removeSessionProfileByToken(token: string): Promise<boolean> {
    const profiles = await KeyStoreWrapper.getSessionProfiles()
    const remaining = profiles.filter((profile) => profile.token !== token)
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
      ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
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
      ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    )
  }
}
