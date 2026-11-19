// The real in-memory mock: the persistor and the markers share one store, as on a device.
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
)

import { gql, InMemoryCache } from "@apollo/client"
import AsyncStorage from "@react-native-async-storage/async-storage"

import { CACHE_OWNER_KEY, SCHEMA_VERSION_KEY } from "@app/config"
import {
  cacheOwnerTag,
  createPersistedCache,
  shouldRestorePersistedCache,
  stripUnpersistableEntries,
} from "@app/graphql/cache-persistence"

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const TOKEN_A = "token-of-account-a"
const TOKEN_B = "token-of-account-b"
const SCHEMA_VERSION = "1"

describe("stripUnpersistableEntries", () => {
  const cache = {
    "ROOT_QUERY": { me: { __ref: "User:1" } },
    "User:1": { __typename: "User", id: "1", username: "alice" },
    "ROOT_MUTATION": {
      __typename: "Mutation",
      userTotpRegistrationInitiate: { totpSecret: "TOTP-SEED" },
      apiKeyCreate: { apiKeySecret: "blink_SECRET" },
    },
  }

  it("drops mutation results, and the secrets they carry, before they reach disk", () => {
    const persisted = stripUnpersistableEntries(JSON.stringify(cache))

    expect(JSON.parse(persisted)).not.toHaveProperty("ROOT_MUTATION")
    expect(persisted).not.toContain("TOTP-SEED")
    expect(persisted).not.toContain("blink_SECRET")
  })

  it("keeps queries and normalized entities", () => {
    const persisted = JSON.parse(stripUnpersistableEntries(JSON.stringify(cache)))

    expect(persisted.ROOT_QUERY).toEqual(cache.ROOT_QUERY)
    expect(persisted["User:1"]).toEqual(cache["User:1"])
  })

  for (const blob of ["not json", "null", "[]", '"a string"']) {
    it(`writes an empty cache for a blob that is not a cache: ${blob}`, () => {
      expect(stripUnpersistableEntries(blob)).toBe("{}")
    })
  }
})

describe("cacheOwnerTag", () => {
  it("is the same for the same session", () => {
    expect(cacheOwnerTag(TOKEN_A)).toBe(cacheOwnerTag(TOKEN_A))
  })

  it("differs between sessions", () => {
    expect(cacheOwnerTag(TOKEN_A)).not.toBe(cacheOwnerTag(TOKEN_B))
  })

  it("does not store the bearer token itself", () => {
    expect(cacheOwnerTag(TOKEN_A)).not.toContain(TOKEN_A)
  })
})

describe("shouldRestorePersistedCache", () => {
  const ownedByA = {
    storedOwner: cacheOwnerTag(TOKEN_A),
    storedSchemaVersion: SCHEMA_VERSION,
    schemaVersion: SCHEMA_VERSION,
  }

  it("restores the cache into the session that wrote it", () => {
    expect(shouldRestorePersistedCache({ token: TOKEN_A, ...ownedByA })).toBe(true)
  })

  it("does not restore one account's cache into another's session", () => {
    expect(shouldRestorePersistedCache({ token: TOKEN_B, ...ownedByA })).toBe(false)
  })

  it("does not restore without a session", () => {
    expect(shouldRestorePersistedCache({ token: "", ...ownedByA })).toBe(false)
  })

  it("does not restore a cache written before owners were recorded", () => {
    expect(
      shouldRestorePersistedCache({ token: TOKEN_A, ...ownedByA, storedOwner: null }),
    ).toBe(false)
  })

  it("does not restore a cache from another schema version", () => {
    expect(
      shouldRestorePersistedCache({
        token: TOKEN_A,
        ...ownedByA,
        storedSchemaVersion: "0",
      }),
    ).toBe(false)
  })
})

describe("createPersistedCache", () => {
  /** Where the persistor keeps the cache: the library's default key. */
  const BLOB_KEY = "apollo-cache-persist"
  /** How long the persistor waits after a cache write before it persists. */
  const PERSIST_DEBOUNCE_MS = 1000
  const ME = gql`
    query Me {
      me {
        id
        username
      }
    }
  `
  const API_KEY_CREATE = gql`
    query ApiKeyCreate {
      apiKeyCreate {
        apiKeySecret
      }
    }
  `

  const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>
  const realSetItem = storage.setItem.getMockImplementation()
  const realRemoveItem = storage.removeItem.getMockImplementation()
  const neverSuperseded = () => false

  const writeMe = (cache: InMemoryCache, username: string) =>
    cache.writeQuery({
      query: ME,
      data: { me: { __typename: "User", id: "1", username } },
    })

  const readUsername = (cache: InMemoryCache): string | undefined =>
    cache.readQuery<{ me: { username: string } }>({ query: ME })?.me.username

  const settle = () =>
    new Promise((resolve) => {
      setImmediate(resolve)
    })

  /** What the persistor writes once the debounce after a cache write runs out. */
  const persistAfterWrite = async () => {
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
    await settle()
  }

  const storedBlob = () => storage.getItem(BLOB_KEY)
  const storedOwner = () => storage.getItem(CACHE_OWNER_KEY)

  /** Opens a fresh client build's persisted cache for the token. */
  const openSession = async (token: string, isSuperseded = neverSuperseded) => {
    const cache = new InMemoryCache()
    const persisted = createPersistedCache(cache)
    await persisted.open(token, isSuperseded)
    return { cache, persisted }
  }

  /** A session of account A that has persisted its cache. */
  const persistAccountA = async () => {
    const { cache } = await openSession(TOKEN_A)
    writeMe(cache, "alice")
    await persistAfterWrite()
  }

  const failSetItemFor = (failingKeys: string[]) => {
    storage.setItem.mockImplementation(async (key: string, value: string) => {
      if (failingKeys.includes(key)) throw new Error("storage unavailable")
      return realSetItem?.(key, value)
    })
  }

  const failRemoveItemFor = (failingKeys: string[]) => {
    storage.removeItem.mockImplementation(async (key: string) => {
      if (failingKeys.includes(key)) throw new Error("storage unavailable")
      return realRemoveItem?.(key)
    })
  }

  /** The persistor logs every write and restore in __DEV__; these tests read storage instead. */
  const devGlobal = globalThis as unknown as { __DEV__: boolean }
  const isDevAtStart = devGlobal.__DEV__

  beforeAll(() => {
    devGlobal.__DEV__ = false
  })

  afterAll(() => {
    devGlobal.__DEV__ = isDevAtStart
  })

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] })
    await storage.clear()
    mockReportError.mockClear()
  })

  afterEach(() => {
    storage.setItem.mockImplementation(realSetItem)
    storage.removeItem.mockImplementation(realRemoveItem)
    jest.useRealTimers()
  })

  it("persists nothing before it knows whose cache it is", async () => {
    const cache = new InMemoryCache()
    createPersistedCache(cache)

    writeMe(cache, "alice")
    await persistAfterWrite()

    expect(await storedBlob()).toBeNull()
  })

  it("persists the session's cache without mutation results once it owns it", async () => {
    const { cache } = await openSession(TOKEN_A)

    writeMe(cache, "alice")
    cache.write({
      dataId: "ROOT_MUTATION",
      query: API_KEY_CREATE,
      result: {
        apiKeyCreate: { __typename: "ApiKeyCreatePayload", apiKeySecret: "blink_SECRET" },
      },
    })
    await persistAfterWrite()

    const blob = await storedBlob()
    expect(JSON.parse(blob ?? "{}")).toHaveProperty("ROOT_QUERY.me")
    expect(blob).not.toContain("ROOT_MUTATION")
    expect(blob).not.toContain("blink_SECRET")
    expect(await storage.getItem(SCHEMA_VERSION_KEY)).toBe(SCHEMA_VERSION)
    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_A))
  })

  it("restores the cache into the session that wrote it", async () => {
    await persistAccountA()

    const { cache } = await openSession(TOKEN_A)

    expect(readUsername(cache)).toBe("alice")
  })

  it("clears one account's cache for another, which then owns it", async () => {
    await persistAccountA()

    const { cache } = await openSession(TOKEN_B)

    expect(readUsername(cache)).toBeUndefined()
    expect(await storedBlob()).toBeNull()
    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_B))
  })

  const markerFailures: Array<[string, string[], string[]]> = [
    ["its owner cannot be stored", [CACHE_OWNER_KEY], []],
    ["its schema version cannot be stored", [SCHEMA_VERSION_KEY], []],
    [
      "neither its owner nor the removal of the earlier one goes through",
      [CACHE_OWNER_KEY],
      [CACHE_OWNER_KEY],
    ],
  ]
  for (const [failure, failingWrites, failingRemovals] of markerFailures) {
    it(`never persists a session when ${failure}, so another account restores nothing of it`, async () => {
      await persistAccountA()
      failSetItemFor(failingWrites)
      failRemoveItemFor(failingRemovals)

      const { cache: cacheOfB } = await openSession(TOKEN_B)
      writeMe(cacheOfB, "bob")
      await persistAfterWrite()

      expect(await storedBlob()).toBeNull()
      expect(await storedOwner()).not.toBe(cacheOwnerTag(TOKEN_B))

      storage.setItem.mockImplementation(realSetItem)
      storage.removeItem.mockImplementation(realRemoveItem)
      const { cache: cacheOfA } = await openSession(TOKEN_A)
      expect(readUsername(cacheOfA)).toBeUndefined()
    })
  }

  it("removes the earlier session's owner when its own cannot be stored", async () => {
    await persistAccountA()
    failSetItemFor([CACHE_OWNER_KEY])

    await openSession(TOKEN_B)

    expect(await storedOwner()).toBeNull()
  })

  it("keeps persistence off, and the cache it could not clear unread, when clearing fails", async () => {
    await persistAccountA()
    failRemoveItemFor([BLOB_KEY])
    const libraryLog = jest.spyOn(console, "error").mockImplementation(() => undefined)

    const { cache } = await openSession(TOKEN_B)
    expect(readUsername(cache)).toBeUndefined()
    writeMe(cache, "bob")
    await persistAfterWrite()

    expect(await storedBlob()).toContain("alice")
    expect(await storedBlob()).not.toContain("bob")
    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_A))
    expect(mockReportError).toHaveBeenCalledWith(
      "Apollo cache persistence",
      expect.any(Error),
    )
    expect(libraryLog).toHaveBeenCalledWith(
      "[apollo-cache-persist]",
      "Error purging cache storage",
      expect.any(Error),
    )
    libraryLog.mockRestore()
  })

  it("replaces its own stored cache it cannot read back, persisting from then on", async () => {
    await persistAccountA()
    await storage.setItem(BLOB_KEY, "not json")
    const libraryLog = jest.spyOn(console, "error").mockImplementation(() => undefined)

    const { cache } = await openSession(TOKEN_A)
    writeMe(cache, "alice again")
    await persistAfterWrite()

    expect(await storedBlob()).toContain("alice again")
    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_A))
    expect(mockReportError).toHaveBeenCalledWith(
      "Apollo cache restore",
      expect.any(Error),
    )
    expect(libraryLog).toHaveBeenCalledWith(
      "[apollo-cache-persist]",
      "Error restoring cache",
      expect.any(Error),
    )
    libraryLog.mockRestore()
  })

  it("persists nothing for a session without a token", async () => {
    const { cache } = await openSession("")

    writeMe(cache, "nobody")
    await persistAfterWrite()

    expect(await storedBlob()).toBeNull()
  })

  it("leaves an account's cache and its markers as they are for a session without a token", async () => {
    await persistAccountA()

    const { cache } = await openSession("")

    expect(readUsername(cache)).toBeUndefined()
    expect(await storedBlob()).toContain("alice")
    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_A))
    expect(await storage.getItem(SCHEMA_VERSION_KEY)).toBe(SCHEMA_VERSION)
  })

  it("gives the cache back to its account after a session without a token", async () => {
    await persistAccountA()
    await openSession("")

    const { cache } = await openSession(TOKEN_A)

    expect(readUsername(cache)).toBe("alice")
  })

  it("still clears the cache for another account after a session without a token", async () => {
    await persistAccountA()
    await openSession("")

    const { cache } = await openSession(TOKEN_B)

    expect(readUsername(cache)).toBeUndefined()
    expect(await storedBlob()).toBeNull()
  })

  const unownedCaches: Array<[string, () => Promise<void>]> = [
    [
      "a full logout removed its markers",
      () => storage.multiRemove([SCHEMA_VERSION_KEY, CACHE_OWNER_KEY]),
    ],
    ["it names no owner", () => storage.removeItem(CACHE_OWNER_KEY)],
    ["it is of another schema", () => storage.setItem(SCHEMA_VERSION_KEY, "0")],
  ]
  for (const [reason, disown] of unownedCaches) {
    it(`clears the cache for a session without a token once ${reason}`, async () => {
      await persistAccountA()
      await disown()

      await openSession("")

      expect(await storedBlob()).toBeNull()
    })
  }

  it("drops a write a retired build had not started", async () => {
    const { cache, persisted } = await openSession(TOKEN_A)
    writeMe(cache, "alice")
    await persistAfterWrite()

    writeMe(cache, "alice later")
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
    persisted.retire()
    await settle()

    expect(await storedBlob()).toContain("alice")
    expect(await storedBlob()).not.toContain("alice later")
  })

  it("persists nothing a retired build writes later, nor serializes its cache for it", async () => {
    const { cache, persisted } = await openSession(TOKEN_A)
    persisted.retire()
    const serialize = jest.spyOn(cache, "extract")

    writeMe(cache, "alice")
    await persistAfterWrite()

    expect(await storedBlob()).toBeNull()
    expect(serialize).not.toHaveBeenCalled()
    serialize.mockRestore()
  })

  it("lets the next build read whose cache it is only once a write already started lands", async () => {
    const { cache: cacheOfA, persisted: persistedOfA } = await openSession(TOKEN_A)
    let landWrite: () => void = () => undefined
    storage.setItem.mockImplementation(async (key: string, value: string) => {
      if (key === BLOB_KEY) {
        await new Promise<void>((resolve) => {
          landWrite = resolve
        })
      }
      return realSetItem?.(key, value)
    })
    writeMe(cacheOfA, "alice")
    await persistAfterWrite()
    persistedOfA.retire()

    const openingB = openSession(TOKEN_B)
    await settle()
    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_A))
    landWrite()
    await openingB

    expect(await storedBlob()).toBeNull()
    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_B))
  })

  it("keeps the next build's open going after a write fails", async () => {
    const { cache, persisted } = await openSession(TOKEN_A)
    failSetItemFor([BLOB_KEY])
    const libraryLog = jest.spyOn(console, "error").mockImplementation(() => undefined)
    writeMe(cache, "alice")

    await expect(persisted.persistor.persist()).rejects.toThrow("storage unavailable")
    storage.setItem.mockImplementation(realSetItem)
    await openSession(TOKEN_B)

    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_B))
    expect(libraryLog).toHaveBeenCalledWith(
      "[apollo-cache-persist]",
      "Error persisting cache",
      expect.any(Error),
    )
    libraryLog.mockRestore()
  })

  it("stops before clearing anything when superseded as the markers are read", async () => {
    await persistAccountA()

    await openSession(TOKEN_B, () => true)

    expect(await storedBlob()).toContain("alice")
    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_A))
  })

  it("stops before naming itself the owner when superseded as it clears the cache", async () => {
    await persistAccountA()
    let isSuperseded = false
    storage.removeItem.mockImplementation(async (key: string) => {
      isSuperseded = true
      return realRemoveItem?.(key)
    })

    const { cache } = await openSession(TOKEN_B, () => isSuperseded)
    writeMe(cache, "bob")
    await persistAfterWrite()

    expect(await storedBlob()).toBeNull()
    expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_A))
  })

  it("does not turn persistence on when superseded as it restores", async () => {
    await persistAccountA()
    let isSuperseded = false
    const realGetItem = storage.getItem.getMockImplementation()
    storage.getItem.mockImplementation(async (key: string) => {
      if (key === BLOB_KEY) isSuperseded = true
      return (await realGetItem?.(key)) ?? null
    })

    const { cache } = await openSession(TOKEN_A, () => isSuperseded)
    storage.getItem.mockImplementation(realGetItem)
    writeMe(cache, "alice later")
    await persistAfterWrite()

    expect(await storedBlob()).not.toContain("alice later")
  })
})
