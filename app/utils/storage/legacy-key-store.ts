import { Platform } from "react-native"
import RNSecureKeyStore, { ACCESSIBLE } from "react-native-secure-key-store"

import type { SecureRead } from "./secure-store"

/**
 * The module that owns the uninstall guard below, so that a legacy touch cannot
 * bypass it by forgetting to re-arm it. The `no-restricted-imports` rule in
 * `.eslintrc.json` is what keeps new call paths from reaching the library
 * directly.
 *
 * The invariant is not complete yet, and this file is not what completes it:
 * `secureStorage.ts` holds the one other exception in that config and still
 * calls the library unguarded, so on iOS the reinstall sweep is armed on its
 * first boot-path read exactly as it is today. That closes when its slots move
 * behind the read-through helper in blinkbitcoin/blink-wip#1161 and the
 * exception goes away.
 *
 * This module is the read-and-erase half of the migration off that library
 * (blinkbitcoin/blink-wip#1143). Its one write is the blank `legacyBlank` erases
 * with, never a value: migrated values are only ever written to the new store.
 *
 * The library is unmaintained and JS cannot see what the keystore answered, so
 * `patches/react-native-secure-key-store+2.0.10.patch` makes both native modules
 * report it:
 *
 * - On Android a resolved `set` or `remove` means the write reached disk. The
 *   module resolved whatever `SharedPreferences.Editor.commit()` returned, so a
 *   write that failed passed for one that landed and the old value came back on
 *   the next launch.
 * - On iOS `get` rejects with the missing-key code only when the keychain reports
 *   the item missing. The module dropped the keychain status and rejected every
 *   lookup that failed as missing, so a keychain that would not answer passed for
 *   an empty one.
 */

/**
 * Both native modules reject a missing key with code "404", and only a missing
 * key (RNSecureKeyStoreModule#get, and ios/RNSecureKeyStore.m `get:` through the
 * patch). Every other code means the read itself went wrong.
 */
const KEY_NOT_FOUND_CODE = "404"

const isKeyNotFound = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  String((err as { code: unknown }).code) === KEY_NOT_FOUND_CODE

/**
 * Re-arms the uninstall guard immediately before every legacy touch.
 *
 * `resetOnAppUninstall` is instance state set to `YES` in the module's `init`,
 * so it has to be re-established per process. Worse, the wipe is only ever
 * skipped, never disarmed: `handleAppUninstallation` sets its
 * `RnSksIsAppInstalled` NSUserDefaults flag *inside* the branch it guards, so a
 * skipped wipe leaves the trigger armed for the next call — and `get:` and
 * `set:` both reach it. Setting it per call rather than once at module load is
 * what makes the guard hold regardless of a bridge reload.
 *
 * It is native-module state, not per-caller state, so once any call here has
 * run the sweep is disarmed for every caller in the process, `secureStorage.ts`
 * included. That is a side effect, not a design: which of them runs first is
 * boot-path ordering nobody controls, so it is not something to rely on.
 *
 * Defense in depth only. The load-bearing defense is that this app's own items
 * are internet credentials, which `clearSecureKeyStore` cannot reach — see
 * `secure-store.ts`. This guard additionally covers `kSecClassKey` items and
 * any future dependency that stores generic passwords.
 *
 * iOS-only: the Android module exports `get` / `set` / `remove` and nothing
 * else, and has no such wipe to disarm.
 */
const disableUninstallReset = (): void => {
  if (Platform.OS !== "ios") return
  try {
    RNSecureKeyStore.setResetOnAppUninstallTo(false)
  } catch {
    // A fire-and-forget void bridge method. A failure here must not stop the
    // operation it precedes.
  }
}

/**
 * An empty stored value reads as absent, matching the new store so that a slot
 * cannot change meaning by migrating.
 */
export const legacyRead = async (key: string): Promise<SecureRead> => {
  disableUninstallReset()
  try {
    const value: unknown = await RNSecureKeyStore.get(key)
    const hasValue = typeof value === "string" && value.length > 0
    if (!hasValue) return { status: "absent" }
    return { status: "found", value }
  } catch (err) {
    if (isKeyNotFound(err)) return { status: "absent" }
    return { status: "failed", err }
  }
}

/**
 * False covers both a failed erase and a key that was never there: iOS `remove:`
 * rejects with code "6" when `deleteKeychainValue` gets `errSecItemNotFound`.
 * On Android a missing key resolves, and a removal resolves only once it is on
 * disk (see the module doc).
 *
 * Not guarded, unlike the read: `remove:` is the one entry point that never
 * reaches `handleAppUninstallation`, so the guard would be a bridge call that
 * provably does nothing.
 */
export const legacyErase = async (key: string): Promise<boolean> => {
  try {
    await RNSecureKeyStore.remove(key)
    return true
  } catch {
    return false
  }
}

/** Read back by both stores as absent, so a blanked key holds nothing either will serve. */
const BLANK = ""

/**
 * Always passed, though the typings call it optional: the iOS `set:` takes it as a fixed
 * argument, and a call without it crashes the native side instead of rejecting. This
 * device-only class keeps a blank the tidy-up delete leaves behind out of every backup.
 */
const BLANK_OPTIONS = { accessible: ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

/**
 * Overwrites a key with nothing: the erase the iOS module can prove where `remove:` cannot.
 *
 * Its `remove:` rejects a key that is not there exactly like a delete that failed, so a
 * refused delete cannot tell an erased key from a keychain that is not answering. `set:`
 * adds the item or replaces the one already there and resolves only once the keychain took
 * the write, so a key that was already gone blanks as cleanly as one that held a value,
 * while a failing keychain refuses. On Android `set` resolves only once the blank is on
 * disk, so it is the same proof there.
 *
 * Guarded like the read: `set:` reaches the reinstall wipe.
 */
export const legacyBlank = async (key: string): Promise<boolean> => {
  disableUninstallReset()
  try {
    await RNSecureKeyStore.set(key, BLANK, BLANK_OPTIONS)
    return true
  } catch {
    return false
  }
}
