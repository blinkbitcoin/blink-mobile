import {
  cacheOwnerTag,
  shouldRestorePersistedCache,
  stripUnpersistableEntries,
} from "@app/graphql/cache-persistence"

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
