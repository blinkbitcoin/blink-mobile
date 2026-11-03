import { sha256 } from "js-sha256"

/** Where Apollo writes mutation results that have no id to normalize under. */
const ROOT_MUTATION = "ROOT_MUTATION"

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
