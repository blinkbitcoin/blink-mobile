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

const queryResult = (
  apiKeys: ApiKeyStub[] | undefined,
  loading = false,
  error: Error | undefined = undefined,
) => ({
  data: apiKeys === undefined ? undefined : { me: { id: "me-1", apiKeys } },
  loading,
  error,
  refetch: jest.fn(),
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
    expect(result.current.isReady).toBe(false)
    expect(result.current.hasError).toBe(false)
  })

  it("is ready once the query settles with data", () => {
    mockUseMigrationApiKeysQuery.mockReturnValue(queryResult([]))

    const { result } = renderHook(() => useActiveApiKeys())

    expect(result.current.isReady).toBe(true)
    expect(result.current.hasError).toBe(false)
  })

  it("flags an error and never reports ready when the query fails", () => {
    mockUseMigrationApiKeysQuery.mockReturnValue(
      queryResult(undefined, false, new Error("network")),
    )

    const { result } = renderHook(() => useActiveApiKeys())

    expect(result.current.hasError).toBe(true)
    expect(result.current.isReady).toBe(false)
    expect(result.current.hasActiveApiKeys).toBe(false)
  })

  it("exposes the query's refetch for a manual retry", () => {
    mockUseMigrationApiKeysQuery.mockReturnValue(queryResult([]))

    const { result } = renderHook(() => useActiveApiKeys())

    expect(typeof result.current.refetch).toBe("function")
  })
})
