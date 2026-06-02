import remoteConfigInstance from "@react-native-firebase/remote-config"

/**
 * Firebase Remote Config only stores primitives (string, number, boolean).
 * Lists and objects must be JSON-encoded as strings on both write and read.
 * These helpers hide that serialization detail so callers can work with the
 * structured value directly.
 */

export const serializeRemoteConfigDefault = (value: unknown): string =>
  JSON.stringify(value)

const tryParseJson = <T>(raw: string, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const getRemoteConfigList = <T>(key: string, fallback: T[]): T[] =>
  tryParseJson<T[]>(remoteConfigInstance().getValue(key).asString(), fallback)

export const getRemoteConfigObject = <T extends object>(key: string, fallback: T): T =>
  tryParseJson<T>(remoteConfigInstance().getValue(key).asString(), fallback)
