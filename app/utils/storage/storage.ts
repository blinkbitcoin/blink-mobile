import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * Loads a string from storage.
 *
 * Collapses an absent key and a failed read into null, which is safe only where
 * either one means do nothing. Use readString anywhere the answer decides
 * whether something gets destroyed.
 *
 * @param key The key to fetch.
 */
export const loadString = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key)
  } catch {
    // not sure why this would fail... even reading the RN docs I'm unclear
    return null
  }
}

/**
 * The outcome of a string read, with "the key is not there" kept apart from
 * "the read failed".
 */
export type StringRead =
  | { readonly status: "found"; readonly value: string }
  | { readonly status: "absent" }
  | { readonly status: "failed"; readonly err: unknown }

/**
 * Loads a string without deciding that a store which could not answer is a
 * store with nothing in it.
 *
 * Added rather than changing loadString, whose null-for-both contract every
 * other caller reads as "skip this". The one caller that cannot live with it is
 * loadPersistentState: an absent blob is its fresh-install signal, and that
 * signal wipes the credentials which outlive an uninstall, mnemonics included.
 * A throwing getItem answered as absent would spend that wipe on a device that
 * was never reinstalled.
 *
 * An empty stored value is reported as found, not absent: a zero-length blob is
 * a write that went wrong, and its caller has a branch for damage that is not
 * the fresh-install one.
 */
export const readString = async (key: string): Promise<StringRead> => {
  try {
    const value = await AsyncStorage.getItem(key)
    if (value === null) return { status: "absent" }
    return { status: "found", value }
  } catch (err) {
    return { status: "failed", err }
  }
}

/**
 * Saves a string to storage.
 *
 * @param key The key to fetch.
 * @param value The value to store.
 */
export const saveString = async (key: string, value: string): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Lists every key currently in storage, or null if the listing failed.
 *
 * Failure is NOT an empty list: a caller that treats "no keys" as "nothing left
 * to do" would otherwise mark a sweep complete that never ran.
 */
export const getAllKeys = async (): Promise<readonly string[] | null> => {
  try {
    return await AsyncStorage.getAllKeys()
  } catch {
    return null
  }
}

/**
 * Saves an object to storage, propagating the underlying write error instead of
 * swallowing it, so a caller whose flow must stop on a failed write can catch it.
 * Best-effort callers should catch and ignore.
 */
export const saveJson = async (key: string, value: unknown): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(value))
}

/**
 * Loads something from storage and runs it thru JSON.parse.
 *
 * @param key The key to fetch.
 */
export const loadJson = async (key: string) => {
  try {
    const data = await AsyncStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

/**
 * Saves an object to storage.
 *
 * @param key The key to fetch.
 * @param value The value to store.
 */
export const save = async (key: string, value: unknown): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Removes something from storage.
 *
 * @param key The key to kill.
 */
export const remove = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key)
  } catch (err) {
    console.error(err)
  }
}

/**
 * Burn it all to the ground.
 */
export const clear = async (): Promise<void> => {
  try {
    await AsyncStorage.clear()
  } catch (err) {
    console.error(err)
  }
}
