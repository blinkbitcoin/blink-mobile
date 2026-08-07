import { renderHook } from "@testing-library/react-native"

import { useCustodialOwnerId } from "@app/screens/account-migration/hooks/use-custodial-owner-id"
import { AccountType } from "@app/types/wallet"

let mockIsAuthed = true
let mockActiveAccount: { type: string } | undefined
let mockQueryResult: { data: unknown; loading: boolean }
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
    mockUseMigrationOwnerQuery.mockImplementation(() => mockQueryResult)
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
    })
  })

  it("skips the query until the session is authenticated", () => {
    mockIsAuthed = false

    renderHook(() => useCustodialOwnerId())

    expect(mockUseMigrationOwnerQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: "no-cache",
    })
  })
})
