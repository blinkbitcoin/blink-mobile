import * as Keychain from "react-native-keychain"

/**
 * The Keychain-backed secure store: one item per slot, read and written through
 * these four primitives only.
 *
 * **Items are internet credentials, never generic passwords.** The legacy
 * `react-native-secure-key-store` module runs an unscoped `SecItemDelete` over
 * `kSecClassGenericPassword` and `kSecClassKey` (`clearSecureKeyStore`,
 * ios/RNSecureKeyStore.m l.118), reached from the first statement of `get:` and
 * `set:` on the first call after a reinstall. Any generic password this app
 * owned would be deleted by that sweep, and the read-through helper is itself
 * what triggers it. `kSecClassInternetPassword` is not in that class list,
 * which is why the app's existing Keychain usage survives today and why this
 * module stores its items the same way.
 *
 * See blinkbitcoin/blink-wip#1160.
 */
const SERVER_NAMESPACE = "secure-store.blink.local"

/**
 * One server per slot, and never a server another feature already owns.
 *
 * iOS queries internet credentials by server with `kSecMatchLimitOne` and no
 * account predicate, so several items sharing a server collapse to one
 * OS-picked entry (the trap documented in `use-credential-backup.ts`). One
 * server per slot means there is only ever one item per server, and
 * `setInternetCredentialsForServer` deletes by server before every insert, so a
 * duplicate cannot be created even by changing the username.
 *
 * The same by-server delete is why the namespace must not collide with
 * `BLINK_DOMAIN`: a slot stored there would erase the iCloud mnemonic backup.
 */
export const serverFor = (slot: string): string => `${SERVER_NAMESPACE}/${slot}`

/**
 * "Nothing stored" is kept distinct from "the read failed". Collapsing them is
 * what lets a transient keystore error be scored as absent and destroy a
 * credential downstream.
 */
export type SecureRead =
  | { readonly status: "found"; readonly value: string }
  | { readonly status: "absent" }
  | { readonly status: "failed"; readonly err: unknown }

export type SecureExists =
  | { readonly status: "yes" }
  | { readonly status: "no" }
  | { readonly status: "failed"; readonly err: unknown }

/**
 * `getInternetCredentials` resolves `false` only for `errSecItemNotFound` and
 * rejects on every other `OSStatus`; on Android it resolves `false` only when
 * the prefs entry is missing and rejects `E_CRYPTO_FAILED` /
 * `E_KEYSTORE_ACCESS_ERROR`. So `false` means absent and a throw means failed,
 * on both platforms.
 *
 * An empty password is reported as absent, preserving the `token ? found :
 * absent` behaviour of the slots this store is replacing.
 */
export const secureRead = async (slot: string): Promise<SecureRead> => {
  try {
    const credentials = await Keychain.getInternetCredentials(serverFor(slot))
    if (credentials === false) return { status: "absent" }
    if (!credentials.password) return { status: "absent" }
    return { status: "found", value: credentials.password }
  } catch (err) {
    return { status: "failed", err }
  }
}

/**
 * Existence without decryption. `hasInternetCredentials` resolves `YES` even on
 * `errSecInteractionNotAllowed`, so a probe answers correctly before the first
 * unlock — which is what lets a boot-path caller ask "is this slot set?"
 * without a protection class that can refuse the read.
 */
export const secureExists = async (slot: string): Promise<SecureExists> => {
  try {
    const exists = await Keychain.hasInternetCredentials({ server: serverFor(slot) })
    if (exists) return { status: "yes" }
    return { status: "no" }
  } catch (err) {
    return { status: "failed", err }
  }
}

/**
 * The secret always goes in `password`; `username` carries the slot name so
 * items are self-describing in a Keychain dump.
 *
 * `accessible` is a required parameter and never defaulted: a default would let
 * a future slot silently inherit the wrong protection class. Choosing it per
 * slot is a real decision, not a copy: `Keychain.ACCESSIBLE` has no
 * `ALWAYS_THIS_DEVICE_ONLY`, which is what every non-mnemonic slot uses today,
 * so each one has to be re-argued when it moves in
 * blinkbitcoin/blink-wip#1161.
 *
 * The options object holds `accessible` and nothing else, deliberately.
 * `accessControl` with any biometry value flips the Android cipher to the
 * authenticating one and makes every boot-path read raise a biometric prompt,
 * and `cloudSync: true` (which the neighbouring credential backup sets on
 * purpose) would push these secrets into the iCloud Keychain.
 *
 * An empty value is refused rather than stored. `secureRead` reports one as
 * absent, so storing it would leave a slot that reads as unset and sends the
 * read-through helper back to the legacy store, resurrecting the stale
 * pre-migration value. Clearing a slot is `secureRemove`'s job.
 */
export const secureWrite = async (
  slot: string,
  value: string,
  accessible: Keychain.ACCESSIBLE,
): Promise<boolean> => {
  if (!value) return false

  try {
    const result = await Keychain.setInternetCredentials(serverFor(slot), slot, value, {
      accessible,
    })
    return result !== false
  } catch {
    return false
  }
}

export const secureRemove = async (slot: string): Promise<boolean> => {
  try {
    await Keychain.resetInternetCredentials({ server: serverFor(slot) })
    return true
  } catch {
    return false
  }
}
