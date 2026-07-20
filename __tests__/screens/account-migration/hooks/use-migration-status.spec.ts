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

  it("skips the query while the user is not authenticated", () => {
    mockIsAuthed = false
    mockUseMigrationStatusQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useMigrationStatus())

    expect(mockUseMigrationStatusQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: "no-cache",
      pollInterval: undefined,
    })
    expect(result.current.status).toBeNull()
  })

  /** Readers who cannot act on the answer should not be asking for it on every launch. */
  it("skips the query when the caller says the question does not apply", () => {
    mockUseMigrationStatusQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useMigrationStatus({ skip: true }))

    expect(mockUseMigrationStatusQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
    expect(result.current.status).toBeNull()
  })

  /** The transfer screen watches a phase it expects to move; every other reader wants
   *  one read per mount. */
  it("re-reads on the interval a caller asks for", () => {
    mockUseMigrationStatusQuery.mockReturnValue(
      migrationWith(MigrationStatus.Transferring),
    )

    renderHook(() => useMigrationStatus({ pollInterval: 2000 }))

    expect(mockUseMigrationStatusQuery).toHaveBeenCalledWith(
      expect.objectContaining({ pollInterval: 2000 }),
    )
  })

  it("reads once per mount when no interval is asked for", () => {
    mockUseMigrationStatusQuery.mockReturnValue(migrationWith(MigrationStatus.NotStarted))

    renderHook(() => useMigrationStatus())

    expect(mockUseMigrationStatusQuery).toHaveBeenCalledWith(
      expect.objectContaining({ pollInterval: undefined }),
    )
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
