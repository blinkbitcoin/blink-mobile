import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * Loads a string from storage.
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
 * Loads something from storage and runs it thru JSON.parse, propagating a failed read
 * or unparsable content instead of reading it as absent, so a caller that must not
 * overwrite a record it could not read can tell the two apart.
 *
 * @param key The key to fetch.
 */
export const loadJsonOrThrow = async (key: string) => {
  const data = await AsyncStorage.getItem(key)
  return data ? JSON.parse(data) : null
}

/**
 * Loads something from storage and runs it thru JSON.parse.
 *
 * @param key The key to fetch.
 */
export const loadJson = async (key: string) => {
  try {
    return await loadJsonOrThrow(key)
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
