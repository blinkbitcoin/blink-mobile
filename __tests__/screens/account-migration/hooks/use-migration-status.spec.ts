import { renderHook } from "@testing-library/react-native"

import { MigrationStatus } from "@app/graphql/generated"
import { useMigrationStatus } from "@app/screens/account-migration/hooks/use-migration-status"

const mockUseMigrationStatusQuery = jest.fn()

let mockIsAuthed = true

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationStatusQuery: (options: unknown) => mockUseMigrationStatusQuery(options),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockIsAuthed,
}))

const migrationWith = (status: MigrationStatus) => ({
  data: {
    migration: { __typename: "AccountMigration" as const, status },
  },
  loading: false,
})

describe("useMigrationStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
  })

  it("serves the phase the server reported", () => {
    mockUseMigrationStatusQuery.mockReturnValue(migrationWith(MigrationStatus.InProgress))

    const { result } = renderHook(() => useMigrationStatus())

    expect(result.current.status).toBe(MigrationStatus.InProgress)
    expect(result.current.loading).toBe(false)
    expect(result.current.isSkipped).toBe(false)
  })

  it("reports loading while the query is in flight, with no status yet", () => {
    mockUseMigrationStatusQuery.mockReturnValue({ data: undefined, loading: true })

    const { result } = renderHook(() => useMigrationStatus())

    expect(result.current.status).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  /** A null status is "the server has not said", and the hook must not turn that into
   *  NOT_STARTED: only the server decides how far this account has gone. */
  it("stays without a status when the server reports no migration node", () => {
    mockUseMigrationStatusQuery.mockReturnValue({
      data: { migration: null },
      loading: false,
    })

    const { result } = renderHook(() => useMigrationStatus())

    expect(result.current.status).toBeNull()
  })

  it("flags the query as skipped while the user is not authenticated", () => {
    mockIsAuthed = false
    mockUseMigrationStatusQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useMigrationStatus())

    expect(mockUseMigrationStatusQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: "no-cache",
    })
    expect(result.current.isSkipped).toBe(true)
    expect(result.current.status).toBeNull()
  })

  it("fetches without touching the cache so one account's phase never locks another", () => {
    mockUseMigrationStatusQuery.mockReturnValue(migrationWith(MigrationStatus.NotStarted))

    renderHook(() => useMigrationStatus())

    expect(mockUseMigrationStatusQuery).toHaveBeenCalledWith({
      skip: false,
      fetchPolicy: "no-cache",
    })
  })
})
