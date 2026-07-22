import { renderHook } from "@testing-library/react-native"

import { MigrationStatus } from "@app/graphql/generated"
import { useMigrationLock } from "@app/screens/account-migration/hooks/use-migration-lock"

const mockUseMigrationStatus = jest.fn()

let mockActiveAccountType: string | undefined = "custodial"

jest.mock("@app/screens/account-migration/hooks/use-migration-status", () => ({
  useMigrationStatus: (options: unknown) => mockUseMigrationStatus(options),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  ...jest.requireActual("@app/hooks/use-account-registry"),
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccountType
      ? { id: "account-1", type: mockActiveAccountType }
      : undefined,
  }),
}))

const serverReports = (
  status: MigrationStatus | null,
  loading = false,
  error: Error | undefined = undefined,
) => ({ status, loading, error, refetch: jest.fn() })

describe("useMigrationLock", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccountType = "custodial"
  })

  it("locks an account the server reports as in progress", () => {
    mockUseMigrationStatus.mockReturnValue(serverReports(MigrationStatus.InProgress))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.isLocked).toBe(true)
  })

  it("locks an account whose transfer is already under way", () => {
    mockUseMigrationStatus.mockReturnValue(serverReports(MigrationStatus.Transferring))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.isLocked).toBe(true)
  })

  it("leaves an account that never started free", () => {
    mockUseMigrationStatus.mockReturnValue(serverReports(MigrationStatus.NotStarted))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.isLocked).toBe(false)
  })

  /** A finished migration swaps the session; keeping the blocker up would trap the user
   *  in a flow with nothing left to do. */
  it("releases a completed migration", () => {
    mockUseMigrationStatus.mockReturnValue(serverReports(MigrationStatus.Completed))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.isLocked).toBe(false)
  })

  /** A failed migration has no client path back, so locking the app would leave the user
   *  staring at a flow they cannot finish or leave. Support owns that case. */
  it("releases a failed migration", () => {
    mockUseMigrationStatus.mockReturnValue(serverReports(MigrationStatus.Failed))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.isLocked).toBe(false)
  })

  /**
   * The decisive case: a status the app could not read must not lock. Locking every
   * offline launch into a migration is a far worse failure than letting an already
   * locked user browse until the next successful read.
   */
  it("leaves the user free while the server has not said", () => {
    mockUseMigrationStatus.mockReturnValue(serverReports(null))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.isLocked).toBe(false)
  })

  /**
   * The lock belongs to the custodial account that started migrating, so a session the
   * user has since switched to must not inherit it. Read from the registry rather than
   * the active wallet, whose no-account placeholder defaults to Custodial and would lock
   * a device that has no account at all.
   */
  it("never locks a self-custodial session", () => {
    mockActiveAccountType = "selfCustodial"
    mockUseMigrationStatus.mockReturnValue(serverReports(MigrationStatus.InProgress))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.isLocked).toBe(false)
  })

  it("never locks a device with no active account", () => {
    mockActiveAccountType = undefined
    mockUseMigrationStatus.mockReturnValue(serverReports(MigrationStatus.InProgress))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.isLocked).toBe(false)
  })

  /** Only a custodial account can be mid-migration, so a self-custodial launch must not
   *  pay for a no-cache status query whose result it discards. */
  it("does not query the phase for a non-custodial account", () => {
    mockActiveAccountType = "selfCustodial"
    mockUseMigrationStatus.mockReturnValue(serverReports(null))

    renderHook(() => useMigrationLock())

    expect(mockUseMigrationStatus).toHaveBeenCalledWith({ skip: true })
  })

  it("queries the phase for a custodial account", () => {
    mockUseMigrationStatus.mockReturnValue(serverReports(MigrationStatus.NotStarted))

    renderHook(() => useMigrationLock())

    expect(mockUseMigrationStatus).toHaveBeenCalledWith({ skip: false })
  })

  /**
   * An unknown lock is not an unlocked one. Without this a caller cannot tell the two
   * apart and renders as if the answer had arrived, which is what made the gate flash
   * its intro at a user it was about to resume.
   */
  it("reports that the answer is still on its way", () => {
    mockUseMigrationStatus.mockReturnValue(serverReports(null, true))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.loading).toBe(true)
    expect(result.current.isLocked).toBe(false)
  })

  /** A session that can never be locked has nothing to wait for. */
  it("never waits on a self-custodial session", () => {
    mockActiveAccountType = "selfCustodial"
    mockUseMigrationStatus.mockReturnValue(serverReports(null, true))

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.loading).toBe(false)
  })

  /**
   * A read the app could not make is not an unlocked account: it reports an error so the
   * gate blocks with a retry, instead of the failed read silently re-pitching the intro to
   * a user the server has already locked into the migration.
   */
  it("reports a read error instead of reading as unlocked", () => {
    mockUseMigrationStatus.mockReturnValue(
      serverReports(null, false, new Error("offline")),
    )

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.hasError).toBe(true)
    expect(result.current.isLocked).toBe(false)
  })

  /** A session that can never be locked has no lock read to fail. */
  it("never reports an error for a self-custodial session", () => {
    mockActiveAccountType = "selfCustodial"
    mockUseMigrationStatus.mockReturnValue(
      serverReports(null, false, new Error("offline")),
    )

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.hasError).toBe(false)
  })

  /** The gate's retry re-runs the lock read through this passthrough. */
  it("passes the status refetch through for the gate's retry", () => {
    const refetch = jest.fn()
    mockUseMigrationStatus.mockReturnValue({
      status: null,
      loading: false,
      error: new Error("offline"),
      refetch,
    })

    const { result } = renderHook(() => useMigrationLock())

    expect(result.current.refetch).toBe(refetch)
  })
})
