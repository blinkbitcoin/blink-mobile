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
  if (!inflight) inflight = resolveOrCreate()
  return inflight
}

export const resetTelemetryInstanceIdCache = (): void => {
  inflight = null
}
