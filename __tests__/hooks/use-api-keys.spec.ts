import { renderHook } from "@testing-library/react-native"

import { Scope } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import {
  ApiKeyItem,
  apiKeyStatus,
  formatScopes,
  useApiKeysList,
} from "@app/screens/settings-screen/api/use-api-keys"

const mockUseApiKeysQuery = jest.fn()
jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useApiKeysQuery: (...args: unknown[]) => mockUseApiKeysQuery(...args),
  }
})

let mockIsAuthed = true
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

loadLocale("en")
const LL = i18nObject("en")

const makeApiKey = (overrides: Partial<ApiKeyItem> = {}): ApiKeyItem => ({
  __typename: "ApiKey",
  id: "key-1",
  name: "BTCPay",
  createdAt: 1700000000,
  revoked: false,
  expired: false,
  lastUsedAt: null,
  expiresAt: null,
  scopes: [Scope.Read, Scope.Receive],
  readOnly: false,
  ...overrides,
})

const queryResult = (
  apiKeys: ApiKeyItem[] | undefined,
  { loading = false, error }: { loading?: boolean; error?: Error } = {},
) => ({
  loading,
  error,
  data: apiKeys && { me: { __typename: "User", id: "user-id", apiKeys } },
})

describe("useApiKeysList", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
    mockUseApiKeysQuery.mockReturnValue(queryResult([]))
  })

  it("always revalidates against the network so dashboard-side changes show up", () => {
    renderHook(() => useApiKeysList())

    expect(mockUseApiKeysQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: false, fetchPolicy: "cache-and-network" }),
    )
  })

  it("skips the query when unauthenticated", () => {
    mockIsAuthed = false

    renderHook(() => useApiKeysList())

    expect(mockUseApiKeysQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("sorts active keys before inactive ones, newest first within each group", () => {
    mockUseApiKeysQuery.mockReturnValue(
      queryResult([
        makeApiKey({ id: "revoked-new", revoked: true, createdAt: 1700000400 }),
        makeApiKey({ id: "active-old", createdAt: 1700000100 }),
        makeApiKey({ id: "expired-old", expired: true, createdAt: 1700000200 }),
        makeApiKey({ id: "active-new", createdAt: 1700000300 }),
      ]),
    )

    const { result } = renderHook(() => useApiKeysList())

    expect(result.current.apiKeys.map((k) => k.id)).toEqual([
      "active-new",
      "active-old",
      "revoked-new",
      "expired-old",
    ])
  })

  it("reports loading while the first fetch is in flight", () => {
    mockUseApiKeysQuery.mockReturnValue(queryResult(undefined, { loading: true }))

    const { result } = renderHook(() => useApiKeysList())

    expect(result.current.loading).toBe(true)
    expect(result.current.apiKeys).toEqual([])
  })

  it("keeps showing cached keys instead of a loading state during a background refresh", () => {
    mockUseApiKeysQuery.mockReturnValue(queryResult([makeApiKey()], { loading: true }))

    const { result } = renderHook(() => useApiKeysList())

    expect(result.current.loading).toBe(false)
    expect(result.current.apiKeys).toHaveLength(1)
  })

  it("reports errors", () => {
    mockUseApiKeysQuery.mockReturnValue(
      queryResult(undefined, { error: new Error("boom") }),
    )

    const { result } = renderHook(() => useApiKeysList())

    expect(result.current.hasError).toBe(true)
  })
})

describe("apiKeyStatus", () => {
  it("labels revoked keys as revoked even when also expired", () => {
    expect(apiKeyStatus(makeApiKey({ revoked: true, expired: true }))).toBe("revoked")
  })

  it("labels expired keys", () => {
    expect(apiKeyStatus(makeApiKey({ expired: true }))).toBe("expired")
  })

  it("labels live keys as active", () => {
    expect(apiKeyStatus(makeApiKey())).toBe("active")
  })
})

describe("formatScopes", () => {
  it("joins localized scope labels", () => {
    expect(formatScopes([Scope.Read, Scope.Receive], LL)).toBe("Read, Receive")
  })

  it("skips scopes the app does not know a label for", () => {
    const scopes = [Scope.Read, "FUTURE_SCOPE" as Scope]
    expect(formatScopes(scopes, LL)).toBe("Read")
  })
})
