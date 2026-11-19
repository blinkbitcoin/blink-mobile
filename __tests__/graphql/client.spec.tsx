// The real in-memory mock: the client's persisted cache and its markers share one store.
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
)

import React from "react"
import { Text } from "react-native"

import { ApolloClient, NormalizedCacheObject } from "@apollo/client"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { render, waitFor } from "@testing-library/react-native"

import { CACHE_OWNER_KEY, SCHEMA_VERSION_KEY } from "@app/config"
import { CACHE_SCHEMA_VERSION, cacheOwnerTag } from "@app/graphql/cache-persistence"
import { GaloyClient } from "@app/graphql/client"

let mockToken = ""
/** One object for every render: a new one would rebuild the client each time. */
const mockAppConfig = {
  galoyInstance: {
    graphqlUri: "https://api.test/graphql",
    graphqlWsUri: "wss://ws.test/graphql",
  },
  token: "",
}
const mockRegisterActiveClient = jest.fn()
/** Every client build's persisted cache, as the real one with its retire observed. */
const mockBuilds: Array<{ retire: jest.Mock }> = []

jest.mock("@app/graphql/cache-persistence", () => {
  const actual = jest.requireActual("@app/graphql/cache-persistence")
  return {
    ...actual,
    createPersistedCache: (...args: unknown[]) => {
      const persisted = actual.createPersistedCache(...args)
      const build = { ...persisted, retire: jest.fn(persisted.retire) }
      mockBuilds.push(build)
      return build
    },
  }
})
jest.mock("@app/graphql/hooks/use-effective-auth-token", () => ({
  useEffectiveAuthToken: () => mockToken,
}))
jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: mockAppConfig }),
}))
jest.mock("@app/graphql/hooks/use-apollo-rebuild-lifecycle", () => ({
  useApolloRebuildLifecycle: () => ({ registerActiveClient: mockRegisterActiveClient }),
}))
jest.mock("@app/screens/get-started-screen/use-device-token", () => ({
  getAppCheckToken: async () => undefined,
}))
jest.mock("@app/hooks/use-account-registry", () => ({
  AccountRegistryProvider: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock("@app/graphql/level-component", () => ({
  LevelContainer: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock("@app/graphql/hide-amount-component", () => ({
  HideAmountContainer: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock("@app/graphql/messaging", () => ({ MessagingContainer: () => null }))
jest.mock("@app/graphql/analytics", () => ({ AnalyticsContainer: () => null }))
jest.mock("@app/graphql/generated", () => ({ useRealtimePriceQuery: jest.fn() }))
jest.mock("@app/hooks/use-effective-language", () => ({
  useEffectiveLanguage: () => ({ language: "en" }),
}))
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ locale: "en", setLocale: jest.fn() }),
}))
jest.mock("@app/i18n/lazy-locale-loader", () => ({ ensureLocaleLoaded: jest.fn() }))

const TOKEN_A = "token-of-account-a"
const TOKEN_B = "token-of-account-b"
/** Where the persistor keeps the cache: the library's default key. */
const BLOB_KEY = "apollo-cache-persist"
const CACHE_OF_A = JSON.stringify({
  "ROOT_QUERY": { me: { __ref: "User:1" } },
  "User:1": { __typename: "User", id: "1", username: "alice" },
})

const storedOwner = () => AsyncStorage.getItem(CACHE_OWNER_KEY)
const storedBlob = () => AsyncStorage.getItem(BLOB_KEY)

/** What an earlier launch of account A left on the device. */
const leaveCacheOfA = () =>
  AsyncStorage.multiSet([
    [BLOB_KEY, CACHE_OF_A],
    [SCHEMA_VERSION_KEY, CACHE_SCHEMA_VERSION],
    [CACHE_OWNER_KEY, cacheOwnerTag(TOKEN_A)],
  ])

const activeClient = (): ApolloClient<NormalizedCacheObject> =>
  mockRegisterActiveClient.mock.calls[mockRegisterActiveClient.mock.calls.length - 1][0]

const renderClient = () =>
  render(
    <GaloyClient>
      <Text>app</Text>
    </GaloyClient>,
  )

describe("GaloyClient cache persistence", () => {
  /** The client announces every build it makes; these tests read storage instead. */
  let buildLog: jest.SpyInstance

  beforeEach(async () => {
    await AsyncStorage.clear()
    mockToken = ""
    mockBuilds.length = 0
    mockRegisterActiveClient.mockClear()
    buildLog = jest.spyOn(console, "log").mockImplementation(() => undefined)
  })

  afterEach(() => {
    expect(buildLog).toHaveBeenCalledWith(
      expect.stringContaining("creating new apollo client"),
    )
    buildLog.mockRestore()
  })

  it("opens the persisted cache for the session before it shows the app", async () => {
    mockToken = TOKEN_A
    await leaveCacheOfA()

    const { findByText } = renderClient()

    expect(await findByText("app")).toBeTruthy()
    expect(activeClient().cache.extract()).toHaveProperty(["User:1", "username"], "alice")
  })

  it("retires the outgoing build's cache and clears it for the next account", async () => {
    mockToken = TOKEN_A
    await leaveCacheOfA()
    const { findByText, rerender } = renderClient()
    await findByText("app")

    mockToken = TOKEN_B
    rerender(
      <GaloyClient>
        <Text>app</Text>
      </GaloyClient>,
    )

    await waitFor(async () => expect(await storedOwner()).toBe(cacheOwnerTag(TOKEN_B)))
    expect(mockBuilds[0].retire).toHaveBeenCalled()
    expect(await storedBlob()).toBeNull()
    expect(activeClient().cache.extract()).not.toHaveProperty("User:1")
  })

  it("gives the cache back to its account after a session without a token", async () => {
    await leaveCacheOfA()
    const { findByText, rerender } = renderClient()
    await findByText("app")
    expect(await storedBlob()).toBe(CACHE_OF_A)

    mockToken = TOKEN_A
    rerender(
      <GaloyClient>
        <Text>app</Text>
      </GaloyClient>,
    )

    await waitFor(() => expect(mockRegisterActiveClient).toHaveBeenCalledTimes(2))
    expect(activeClient().cache.extract()).toHaveProperty(["User:1", "username"], "alice")
  })

  it("clears the cache a full logout left without markers", async () => {
    await leaveCacheOfA()
    await AsyncStorage.multiRemove([SCHEMA_VERSION_KEY, CACHE_OWNER_KEY])

    const { findByText } = renderClient()
    await findByText("app")

    expect(await storedBlob()).toBeNull()
  })

  it("never shows a build superseded while its cache opens", async () => {
    mockToken = TOKEN_A
    await leaveCacheOfA()
    const { findByText, rerender } = renderClient()

    mockToken = TOKEN_B
    rerender(
      <GaloyClient>
        <Text>app</Text>
      </GaloyClient>,
    )
    await findByText("app")

    expect(mockBuilds[0].retire).toHaveBeenCalled()
    expect(mockRegisterActiveClient).toHaveBeenCalledTimes(1)
    expect(activeClient().cache.extract()).not.toHaveProperty("User:1")
  })

  it("retires the build's cache when the client goes away", async () => {
    mockToken = TOKEN_A
    const { findByText, unmount } = renderClient()
    await findByText("app")

    unmount()

    expect(mockBuilds[0].retire).toHaveBeenCalled()
  })
})
