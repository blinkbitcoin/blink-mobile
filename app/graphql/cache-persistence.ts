import { CachePersistor } from "apollo3-cache-persist"
import { sha256 } from "js-sha256"

import { InMemoryCache, NormalizedCacheObject } from "@apollo/client"
import AsyncStorage from "@react-native-async-storage/async-storage"

import { CACHE_OWNER_KEY, SCHEMA_VERSION_KEY } from "@app/config"
import { reportError } from "@app/utils/error-logging"
import { loadString, removeOrThrow, saveString } from "@app/utils/storage"

/** Where Apollo writes mutation results that have no id to normalize under. */
const ROOT_MUTATION = "ROOT_MUTATION"

/** The version of what the persisted cache holds: a cache of another one is never restored. */
export const CACHE_SCHEMA_VERSION = "1"

/**
 * Filters the serialized cache before it is written to AsyncStorage, which is
 * plaintext at rest. Mutation results are dropped whole: they are never read
 * back from a restored cache, and they are where one-time secrets such as
 * `totpSecret` and `apiKeySecret` land. A blob that does not parse is written
 * as an empty cache rather than as-is.
 */
export const stripUnpersistableEntries = (serialized: string): string => {
  let data: unknown
  try {
    data = JSON.parse(serialized)
  } catch {
    return "{}"
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return "{}"

  const { [ROOT_MUTATION]: _mutations, ...persistable } = data as Record<string, unknown>
  return JSON.stringify(persistable)
}

/** Names the account a persisted cache belongs to without storing its bearer token. */
export const cacheOwnerTag = (token: string): string => sha256(token)

/**
 * A persisted cache is restored only into the session that wrote it. Any other
 * session — another account, no account, or a cache from an older schema or
 * from before owners were recorded — gets an empty cache instead, so one
 * account's data never renders inside another's.
 */
export const shouldRestorePersistedCache = ({
  token,
  storedOwner,
  storedSchemaVersion,
  schemaVersion,
}: {
  token: string
  storedOwner: string | null
  storedSchemaVersion: string | null
  schemaVersion: string
}): boolean =>
  Boolean(token) &&
  storedSchemaVersion === schemaVersion &&
  storedOwner === cacheOwnerTag(token)

/**
 * The latest piece of work on the persisted cache, from any client build. Each cache write
 * and each `open` waits for the one before, so a write a superseded build had already
 * started lands before the next build reads whose cache it is, and is cleared with it.
 */
let latestCacheWork: Promise<unknown> = Promise.resolve()

const afterEarlierCacheWork = <T>(work: () => Promise<T>): Promise<T> => {
  const thisWork = latestCacheWork.then(work)
  latestCacheWork = thisWork.catch(() => undefined)
  return thisWork
}

/**
 * Whether the stored cache still belongs to an account: one of this schema, with its owner
 * named. Only that account can restore it.
 */
const isOwnedCache = ({
  storedOwner,
  storedSchemaVersion,
}: {
  storedOwner: string | null
  storedSchemaVersion: string | null
}): boolean => storedSchemaVersion === CACHE_SCHEMA_VERSION && storedOwner !== null

/**
 * Marks the cache just cleared as the session's, and answers whether it now is: true only
 * once both the schema version and the owner are stored. Whenever the answer is false,
 * the owner left from an earlier session is removed too, so nothing written later can
 * pass for that session's cache.
 */
const storeOwnerOf = async (token: string): Promise<boolean> => {
  const isSchemaStored = await saveString(SCHEMA_VERSION_KEY, CACHE_SCHEMA_VERSION)
  const isOwnerStored =
    isSchemaStored && (await saveString(CACHE_OWNER_KEY, cacheOwnerTag(token)))
  if (!isOwnerStored) {
    /** Best effort: the cache was just cleared, so an owner left behind owns nothing. */
    await removeOrThrow(CACHE_OWNER_KEY).catch(() => undefined)
  }
  return isOwnerStored
}

export type PersistedCache = {
  readonly persistor: CachePersistor<NormalizedCacheObject>
  /**
   * Restores the persisted cache into the session that wrote it, or clears it for this
   * one, and only then turns persistence on. Persistence stays off whenever it cannot be
   * told whose the cache is: without a token, when the markers that name the owner could
   * not be stored, or when storage failed on the way. The session then runs on its
   * in-memory cache alone, and the next client build tries again. A session without a
   * token restores nothing and leaves an account's cache where it is. Never rejects.
   */
  readonly open: (token: string, isSuperseded: () => boolean) => Promise<void>
  /**
   * Ends the build's persistence once it is superseded. A write it has not started yet is
   * dropped; one already started lands before the next build's `open` runs.
   */
  readonly retire: () => void
}

/**
 * The persisted cache of one client build: the persistor over AsyncStorage, created
 * paused, so nothing reaches disk before `open` knows whose cache it is writing.
 */
export const createPersistedCache = (cache: InMemoryCache): PersistedCache => {
  let isRetired = false
  /** Writes wait their turn, and a retired build writes nothing more. Reads and removals
   *  go straight through: neither can put one account's data under another's name. */
  const storage = {
    getItem: (key: string) => AsyncStorage.getItem(key),
    setItem: (key: string, value: string) =>
      afterEarlierCacheWork(async () => {
        if (isRetired) return
        await AsyncStorage.setItem(key, value)
      }),
    removeItem: (key: string) => AsyncStorage.removeItem(key),
  }
  const persistor = new CachePersistor({
    cache,
    storage,
    debug: __DEV__,
    persistenceMapper: async (data) => stripUnpersistableEntries(data),
  })
  persistor.pause()

  const openFor = async (token: string, isSuperseded: () => boolean): Promise<void> => {
    const [storedSchemaVersion, storedOwner] = await Promise.all([
      loadString(SCHEMA_VERSION_KEY),
      loadString(CACHE_OWNER_KEY),
    ])
    if (isSuperseded()) return

    if (!token) {
      /** No session to persist for, so persistence stays off. A cache an account still
       *  owns is left as it is, markers included, for that account to come back to: a
       *  sign-out that keeps the stored credentials, or a switch to a self-custodial
       *  account. One nobody owns any more, as after a full logout removed its markers,
       *  is cleared. */
      const isCacheKept = isOwnedCache({ storedOwner, storedSchemaVersion })
      if (!isCacheKept) await persistor.purge()
      return
    }

    const isOwnCache = shouldRestorePersistedCache({
      token,
      storedOwner,
      storedSchemaVersion,
      schemaVersion: CACHE_SCHEMA_VERSION,
    })
    if (isOwnCache) {
      /** Its own cache it cannot read back is no reason to stop persisting: the next
       *  write replaces it, under the same owner. */
      await persistor.restore().catch((err) => reportError("Apollo cache restore", err))
    } else {
      // Another account's, or an outdated cache: never shown here.
      await persistor.purge()
      if (isSuperseded()) return
      const isOwnedNow = await storeOwnerOf(token)
      if (!isOwnedNow) return
    }
    if (isSuperseded()) return
    persistor.resume()
  }

  const open = (token: string, isSuperseded: () => boolean): Promise<void> =>
    afterEarlierCacheWork(async () => {
      try {
        await openFor(token, isSuperseded)
      } catch (err) {
        reportError("Apollo cache persistence", err)
      }
    })

  const retire = () => {
    isRetired = true
    persistor.pause()
  }

  return { persistor, open, retire }
}
