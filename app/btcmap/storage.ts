import AsyncStorage from "@react-native-async-storage/async-storage"

import { BtcMapPlace, BtcMapSnapshot } from "./types"

const META_KEY = "btcMapPlacesMeta"
const CHUNK_KEY_PREFIX = "btcMapPlacesChunk"
const chunkKey = (index: number) => `${CHUNK_KEY_PREFIX}${index}`

// Bump when the stored place shape changes so old rows are discarded instead of
// being read back as garbage.
const SCHEMA_VERSION = 1

// AsyncStorage on Android is SQLite, whose CursorWindow caps a single row at
// 2 MB. Today's ~29k places serialise to about 2.4 MB, so one row would already
// be over; slicing at 5k puts each at roughly 400 KB, with room for the list to
// keep growing.
const CHUNK_SIZE = 5000

type StoredMeta = {
  version: number
  syncedUpTo: string
  lastSyncedAt: string
  chunkCount: number
}

const isStoredPlace = (value: unknown): value is BtcMapPlace => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const place = value as Record<string, unknown>
  return (
    typeof place.id === "number" &&
    Number.isSafeInteger(place.id) &&
    place.id > 0 &&
    typeof place.latitude === "number" &&
    Number.isFinite(place.latitude) &&
    place.latitude >= -90 &&
    place.latitude <= 90 &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.longitude) &&
    place.longitude >= -180 &&
    place.longitude <= 180 &&
    typeof place.icon === "string" &&
    (place.boostedUntil === undefined || typeof place.boostedUntil === "string")
  )
}

const isStoredMeta = (value: unknown): value is StoredMeta => {
  if (!value || typeof value !== "object") return false
  const meta = value as Record<string, unknown>
  return (
    meta.version === SCHEMA_VERSION &&
    typeof meta.syncedUpTo === "string" &&
    typeof meta.lastSyncedAt === "string" &&
    typeof meta.chunkCount === "number"
  )
}

const parseJson = (raw: string | null): unknown => {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const readMeta = async (): Promise<StoredMeta | null> => {
  const meta = parseJson(await AsyncStorage.getItem(META_KEY))
  return isStoredMeta(meta) ? meta : null
}

const existingChunkKeys = async (): Promise<string[]> => {
  const keys = await AsyncStorage.getAllKeys()
  return keys.filter((key) => key.startsWith(CHUNK_KEY_PREFIX))
}

export const readSnapshot = async (): Promise<BtcMapSnapshot | null> => {
  const meta = await readMeta()
  if (!meta) return null

  const keys = Array.from({ length: meta.chunkCount }, (_, index) => chunkKey(index))
  const rows = await AsyncStorage.multiGet(keys)

  const places: BtcMapPlace[] = []
  for (const [, value] of rows) {
    const chunk = parseJson(value)
    // A missing or unreadable chunk means a torn snapshot, and half a map is
    // worse than no map — fall back to a cold load from the CDN.
    if (!Array.isArray(chunk) || !chunk.every(isStoredPlace)) return null
    places.push(...chunk)
  }

  return { places, syncedUpTo: meta.syncedUpTo, lastSyncedAt: meta.lastSyncedAt }
}

/**
 * Replace the cached snapshot.
 *
 * The meta row is dropped before the chunks are rewritten and only restored once
 * they are all in, so a write interrupted by the process dying reads back as
 * "no cache" on the next launch — one extra CDN fetch — rather than as a map
 * that is silently missing places.
 */
export const writeSnapshot = async (snapshot: BtcMapSnapshot): Promise<void> => {
  const chunks: BtcMapPlace[][] = []
  for (let index = 0; index < snapshot.places.length; index += CHUNK_SIZE) {
    chunks.push(snapshot.places.slice(index, index + CHUNK_SIZE))
  }

  // Taken from the keys that are actually on disk rather than from the meta
  // row, because the meta row is exactly what a torn write or a schema bump
  // leaves missing — and that is when orphan chunks pile up.
  const staleKeys = (await existingChunkKeys()).filter(
    (key) => !chunks.some((_, index) => chunkKey(index) === key),
  )

  await AsyncStorage.removeItem(META_KEY)

  await AsyncStorage.multiSet(
    chunks.map((chunk, index) => [chunkKey(index), JSON.stringify(chunk)]),
  )

  if (staleKeys.length) await AsyncStorage.multiRemove(staleKeys)

  const meta: StoredMeta = {
    version: SCHEMA_VERSION,
    syncedUpTo: snapshot.syncedUpTo,
    lastSyncedAt: snapshot.lastSyncedAt,
    chunkCount: chunks.length,
  }
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta))
}

/**
 * Record that a sync happened without rewriting the places.
 *
 * Most hourly syncs come back with nothing changed, and re-serialising ~2.4 MB
 * to store two new timestamps is not worth the stall.
 */
export const writeSyncMarkers = async (
  markers: Pick<BtcMapSnapshot, "syncedUpTo" | "lastSyncedAt">,
): Promise<void> => {
  const meta = await readMeta()
  if (!meta) return

  await AsyncStorage.setItem(
    META_KEY,
    JSON.stringify({ ...meta, ...markers } satisfies StoredMeta),
  )
}
