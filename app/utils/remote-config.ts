import remoteConfigInstance from "@react-native-firebase/remote-config"

import { logError } from "./log-error"

/**
 * Firebase Remote Config stores only JSON-encoded strings. These helpers parse
 * them back and surface ops misconfigurations via `logError`, so a silent
 * revert to baked-in defaults is observable.
 */

const SCOPE = "remote-config"

export const serializeRemoteConfigDefault = (value: unknown): string =>
  JSON.stringify(value)

const tryParseJson = <T>(raw: string, fallback: T, key: string): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    logError({
      scope: SCOPE,
      error: new Error(`Invalid JSON for "${key}": ${reason}`),
      context: { key, rawSnippet: raw.slice(0, 100) },
    })
    return fallback
  }
}

const describeShape = (value: unknown): string => {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const getRemoteConfigList = <T>(key: string, fallback: T[]): T[] => {
  const parsed = tryParseJson<unknown>(
    remoteConfigInstance().getValue(key).asString(),
    fallback,
    key,
  )
  if (Array.isArray(parsed)) return parsed as T[]
  if (parsed !== fallback) {
    logError({
      scope: SCOPE,
      error: new Error(`Expected JSON array for "${key}"`),
      context: { key, actualShape: describeShape(parsed) },
    })
  }
  return fallback
}

export const getRemoteConfigStringList = (key: string, fallback: string[]): string[] => {
  const raw = getRemoteConfigList<unknown>(key, fallback)
  if (raw === fallback) return fallback

  const strings: string[] = []
  let droppedCount = 0
  for (const entry of raw) {
    if (typeof entry === "string") {
      strings.push(entry.toUpperCase())
    } else {
      droppedCount += 1
    }
  }
  if (droppedCount > 0) {
    logError({
      scope: SCOPE,
      error: new Error(`Dropped ${droppedCount} non-string entries from "${key}"`),
      context: { key, droppedCount, totalEntries: raw.length },
    })
  }
  return strings
}

export const getRemoteConfigObject = <T extends object>(key: string, fallback: T): T => {
  const parsed = tryParseJson<unknown>(
    remoteConfigInstance().getValue(key).asString(),
    fallback,
    key,
  )
  if (isPlainObject(parsed)) return parsed as T
  if (parsed !== fallback) {
    logError({
      scope: SCOPE,
      error: new Error(`Expected JSON object for "${key}"`),
      context: { key, actualShape: describeShape(parsed) },
    })
  }
  return fallback
}
