import { renderHook } from "@testing-library/react-native"

import { useMigrationPreview } from "@app/screens/account-migration/hooks/use-migration-preview"

const mockUseMigrationQuery = jest.fn()

let mockIsAuthed = true

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationQuery: (options: unknown) => mockUseMigrationQuery(options),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockIsAuthed,
}))

const serverPreview = {
  __typename: "AccountMigrationPreview" as const,
  balanceSats: 200_000,
  feeSats: 1_000,
  feeCoveredByBlink: false,
  receiveSats: 199_000,
}

const serverMigration = {
  __typename: "AccountMigration" as const,
  preview: serverPreview,
}

describe("useMigrationPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
  })

  it("serves the server preview, mapped to the domain shape", () => {
    mockUseMigrationQuery.mockReturnValue({
      data: { migration: serverMigration },
      loading: false,
    })

    const { result } = renderHook(() => useMigrationPreview())

    const { __typename, ...domainPreview } = serverPreview
    expect(result.current.preview).toEqual(domainPreview)
    expect(result.current.loading).toBe(false)
  })

  it("reports loading while the query is in flight, with no preview yet", () => {
    mockUseMigrationQuery.mockReturnValue({ data: undefined, loading: true })

    const { result } = renderHook(() => useMigrationPreview())

    expect(result.current.preview).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  /** A settled null is the answer, not a wait: callers rely on loading to tell the two
   *  apart, so a preview that will never arrive never reads as one still coming. */
  it("settles with no preview and no connection issue when no migration applies", () => {
    mockUseMigrationQuery.mockReturnValue({
      data: { migration: null },
      loading: false,
    })

    const { result } = renderHook(() => useMigrationPreview())

    expect(result.current.preview).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.hasConnectionIssue).toBe(false)
  })

  it("flags a connection issue when the network is what failed", () => {
    mockUseMigrationQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { networkError: new Error("Network request failed") },
    })

    const { result } = renderHook(() => useMigrationPreview())

    expect(result.current.hasConnectionIssue).toBe(true)
  })

  /** A server that answered and rejected is final, so it must not read as retryable. */
  it("does not flag a connection issue when the server rejected the query", () => {
    mockUseMigrationQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { graphQLErrors: [new Error("Unexpected server error")] },
    })

    const { result } = renderHook(() => useMigrationPreview())

    expect(result.current.preview).toBeNull()
    expect(result.current.hasConnectionIssue).toBe(false)
  })

  it("exposes the query refetch so a caller can offer a retry", () => {
    const refetch = jest.fn()
    mockUseMigrationQuery.mockReturnValue({ data: undefined, loading: false, refetch })

    const { result } = renderHook(() => useMigrationPreview())
    result.current.refetch()

    expect(refetch).toHaveBeenCalled()
  })

  /** A skipped query reports neither loading nor error, so without isSkipped a caller
   *  would read the same shape as a server that answered with nothing. */
  it("flags the query as skipped while the user is not authenticated", () => {
    mockIsAuthed = false
    mockUseMigrationQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useMigrationPreview())

    expect(mockUseMigrationQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: "no-cache",
      notifyOnNetworkStatusChange: true,
    })
    expect(result.current.isSkipped).toBe(true)
    expect(result.current.preview).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.hasConnectionIssue).toBe(false)
  })

  it("does not flag a skip once the query runs", () => {
    mockUseMigrationQuery.mockReturnValue({
      data: { migration: serverMigration },
      loading: false,
    })

    const { result } = renderHook(() => useMigrationPreview())

    expect(result.current.isSkipped).toBe(false)
  })

  it("fetches without touching the cache so a switch never serves the previous account's preview", () => {
    mockUseMigrationQuery.mockReturnValue({
      data: { migration: serverMigration },
      loading: false,
    })

    renderHook(() => useMigrationPreview())

    expect(mockUseMigrationQuery).toHaveBeenCalledWith({
      skip: false,
      fetchPolicy: "no-cache",
      notifyOnNetworkStatusChange: true,
    })
  })

  /** The retry runs for seconds behind the RetryLink's attempts, so a refetch has to
   *  reopen loading or the screen offering it never shows the attempt. */
  it("reopens loading for a refetch so the retry it offers is visible", () => {
    mockUseMigrationQuery.mockReturnValue({ data: undefined, loading: true })

    renderHook(() => useMigrationPreview())

    expect(mockUseMigrationQuery).toHaveBeenCalledWith(
      expect.objectContaining({ notifyOnNetworkStatusChange: true }),
    )
  })
})
