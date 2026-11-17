import { renderHook } from "@testing-library/react-native"

import { useCustodialOwnerId } from "@app/screens/account-migration/hooks/use-custodial-owner-id"
import { AccountType } from "@app/types/wallet"

let mockIsAuthed = true
let mockActiveAccount: { type: string } | undefined
let mockQueryResult: { data: unknown; loading: boolean; error?: unknown }
const mockRefetch = jest.fn()
const mockUseMigrationOwnerQuery = jest.fn()

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

jest.mock("@app/graphql/generated", () => ({
  useMigrationOwnerQuery: (options: unknown) => mockUseMigrationOwnerQuery(options),
}))

describe("useCustodialOwnerId", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
    mockActiveAccount = { type: AccountType.Custodial }
    mockQueryResult = { data: undefined, loading: false }
    mockUseMigrationOwnerQuery.mockImplementation(() => ({
      ...mockQueryResult,
      refetch: mockRefetch,
    }))
  })

  it("returns the Galoy account id for a custodial session", () => {
    mockQueryResult = {
      data: { me: { defaultAccount: { id: "galoy-account-1" } } },
      loading: false,
    }

    const { result } = renderHook(() => useCustodialOwnerId())

    expect(result.current.ownerId).toBe("galoy-account-1")
    expect(result.current.loading).toBe(false)
    expect(mockUseMigrationOwnerQuery).toHaveBeenCalledWith({
      skip: false,
      fetchPolicy: "no-cache",
      notifyOnNetworkStatusChange: true,
    })
  })

  it("stays loading while the custodial owner query is in flight", () => {
    mockQueryResult = { data: undefined, loading: true }

    const { result } = renderHook(() => useCustodialOwnerId())

    expect(result.current.ownerId).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it("returns null when the query resolves without an account", () => {
    mockQueryResult = { data: { me: null }, loading: false }

    const { result } = renderHook(() => useCustodialOwnerId())

    expect(result.current.ownerId).toBeNull()
  })

  it("returns null and never loads for a non-custodial session", () => {
    mockActiveAccount = { type: AccountType.SelfCustodial }
    mockQueryResult = { data: undefined, loading: true }

    const { result } = renderHook(() => useCustodialOwnerId())

    expect(result.current.ownerId).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(mockUseMigrationOwnerQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: "no-cache",
      notifyOnNetworkStatusChange: true,
    })
  })

  it("skips the query until the session is authenticated", () => {
    mockIsAuthed = false

    const { result } = renderHook(() => useCustodialOwnerId())

    expect(result.current.isSkipped).toBe(true)
    expect(mockUseMigrationOwnerQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: "no-cache",
      notifyOnNetworkStatusChange: true,
    })
  })

  /**
   * A failed request is not the server answering that this account has no owner. Callers
   * spend the difference on an irreversible step, so a failure travels apart from an
   * answer: it earns a retry, where an answer with no owner is what they hand to support.
   */
  it("names a failed query as the reason the owner is unknown", () => {
    mockQueryResult = {
      data: undefined,
      loading: false,
      error: { networkError: new Error("offline") },
    }

    const { result } = renderHook(() => useCustodialOwnerId())

    expect(result.current.ownerId).toBeNull()
    expect(result.current.hasError).toBe(true)
    expect(result.current.isSkipped).toBe(false)
  })

  /** An authenticated custodial session always has an owner, so a server error is a failed
   *  request like any other, never the answer that this account has none. */
  it("reports a server error the same as a dropped one", () => {
    mockQueryResult = {
      data: { me: null },
      loading: false,
      error: { graphQLErrors: [{ message: "nope" }] },
    }

    const { result } = renderHook(() => useCustodialOwnerId())

    expect(result.current.ownerId).toBeNull()
    expect(result.current.hasError).toBe(true)
  })

  it("reports no error on a query that answered", () => {
    mockQueryResult = {
      data: { me: { defaultAccount: { id: "galoy-account-1" } } },
      loading: false,
    }

    const { result } = renderHook(() => useCustodialOwnerId())

    expect(result.current.hasError).toBe(false)
  })

  it("hands the query's own refetch to callers", async () => {
    const { result } = renderHook(() => useCustodialOwnerId())

    await result.current.refetch()

    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  /** A skipped query sits on standby, where a refetch runs it regardless of the skip: the
   *  one session that must never ask for `me` is the one that stopped being custodial. */
  it("does not run the query on a refetch while it is skipped", async () => {
    mockActiveAccount = { type: AccountType.SelfCustodial }

    const { result } = renderHook(() => useCustodialOwnerId())
    await result.current.refetch()

    expect(mockRefetch).not.toHaveBeenCalled()
  })
})
