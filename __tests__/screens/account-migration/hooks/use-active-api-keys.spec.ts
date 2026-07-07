import { renderHook } from "@testing-library/react-native"

import { useActiveApiKeys } from "@app/screens/account-migration/hooks/use-active-api-keys"

const mockUseMigrationApiKeysQuery = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationApiKeysQuery: () => mockUseMigrationApiKeysQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

type ApiKeyStub = { id: string; revoked: boolean; expired: boolean }

const queryResult = (apiKeys: ApiKeyStub[] | undefined, loading = false) => ({
  data: apiKeys === undefined ? undefined : { me: { id: "me-1", apiKeys } },
  loading,
})

describe("useActiveApiKeys", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("reports active keys when at least one is neither revoked nor expired", () => {
    mockUseMigrationApiKeysQuery.mockReturnValue(
      queryResult([
        { id: "1", revoked: true, expired: false },
        { id: "2", revoked: false, expired: false },
      ]),
    )

    const { result } = renderHook(() => useActiveApiKeys())

    expect(result.current.hasActiveApiKeys).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it("reports no active keys when all are revoked or expired", () => {
    mockUseMigrationApiKeysQuery.mockReturnValue(
      queryResult([
        { id: "1", revoked: true, expired: false },
        { id: "2", revoked: false, expired: true },
      ]),
    )

    const { result } = renderHook(() => useActiveApiKeys())

    expect(result.current.hasActiveApiKeys).toBe(false)
  })

  it("reports no active keys when the account has none", () => {
    mockUseMigrationApiKeysQuery.mockReturnValue(queryResult([]))

    const { result } = renderHook(() => useActiveApiKeys())

    expect(result.current.hasActiveApiKeys).toBe(false)
  })

  it("reports no active keys and stays loading while the query is in flight", () => {
    mockUseMigrationApiKeysQuery.mockReturnValue(queryResult(undefined, true))

    const { result } = renderHook(() => useActiveApiKeys())

    expect(result.current.hasActiveApiKeys).toBe(false)
    expect(result.current.loading).toBe(true)
  })
})
