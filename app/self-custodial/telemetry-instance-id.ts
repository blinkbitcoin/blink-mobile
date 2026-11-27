import AsyncStorage from "@react-native-async-storage/async-storage"
import Crypto from "react-native-quick-crypto"

const STORAGE_KEY = "telemetryInstanceId"

const resolveOrCreate = async (): Promise<string> => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY)
  if (stored) return stored
  const id = Crypto.randomUUID()
  await AsyncStorage.setItem(STORAGE_KEY, id)
  return id
}

let inflight: Promise<string> | null = null

/**
 * The identity Enhanced telemetry reports under: a random UUID minted once per install.
 * It is deliberately not derived from the pubkey or any device identifier — nothing can
 * join it back to funds, and a reinstall starts a fresh instance, which is exactly the
 * "app instances" unit the dashboard counts. Plain AsyncStorage, not the keychain: it
 * identifies nothing sensitive.
 *
 * The promise itself is cached, so concurrent first callers share one mint.
 */
export const getTelemetryInstanceId = (): Promise<string> => {
  if (!inflight) {
    /** A failed read is not cached: the next caller tries again. */
    inflight = resolveOrCreate().catch((err) => {
      inflight = null
      throw err
    })
  }
  return inflight
}

/**
 * The id if this install already has one, and null otherwise; never creates one. For the
 * log export, which shows the id to support (R27): an id created only to be shared would
 * have no events behind it, so only an id Enhanced telemetry already reports under is
 * worth sharing. A failed read is null too: the export goes out without the line.
 */
export const peekTelemetryInstanceId = async (): Promise<string | null> => {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) || null
  } catch {
    return null
  }
}

export const resetTelemetryInstanceIdCache = (): void => {
  inflight = null
}
