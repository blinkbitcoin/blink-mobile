import { act, renderHook } from "@testing-library/react-native"

import { useEnsureMigrationStarted } from "@app/screens/account-migration/hooks/use-ensure-migration-started"

import { flushEffects } from "../../../helpers/flush-effects"

const mockMigrationStart = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationStartMutation: () => [mockMigrationStart],
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

const accepted = { data: { migrationStart: { errors: [] } } }

/** A representative start refusal now that eligibility is no longer one: the backend
 *  still refuses a non-empty dollar balance, mapped to MIGRATION_STATE_CONFLICT. */
const refusedWith = (message: string) => ({
  data: { migrationStart: { errors: [{ message, code: "MIGRATION_STATE_CONFLICT" }] } },
})

const DOLLAR_BALANCE_REFUSAL = "Dollar balance must be empty before migration"

const networkFailure = () => {
  const err = new Error("Network request failed")
  return Object.assign(err, { networkError: new Error("offline") })
}

describe("useEnsureMigrationStarted", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMigrationStart.mockResolvedValue(accepted)
  })

  it("declares the migration started once the caller stops skipping", async () => {
    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()

    expect(mockMigrationStart).toHaveBeenCalledTimes(1)
    expect(result.current.isStarted).toBe(true)
    expect(result.current.isRejected).toBe(false)
  })

  /** The commit screen must not claim the user consented to migrating figures it cannot
   *  show, so the mutation waits for them. */
  it("does not fire while the caller is skipping", async () => {
    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: true }))
    await flushEffects()

    expect(mockMigrationStart).not.toHaveBeenCalled()
    expect(result.current.isStarted).toBe(false)
  })

  it("fires once the caller stops skipping, not before", async () => {
    const { rerender } = renderHook(
      ({ skip }: { skip: boolean }) => useEnsureMigrationStarted({ skip }),
      { initialProps: { skip: true } },
    )
    await flushEffects()
    expect(mockMigrationStart).not.toHaveBeenCalled()

    rerender({ skip: false })
    await flushEffects()

    expect(mockMigrationStart).toHaveBeenCalledTimes(1)
  })

  /** Re-rendering must not open a second flow: the claim is taken before the request
   *  goes out, not after it answers. */
  it("fires only once across re-renders", async () => {
    const { rerender } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()
    rerender({})
    rerender({})
    await flushEffects()

    expect(mockMigrationStart).toHaveBeenCalledTimes(1)
  })

  it("treats a refusal in the payload as final and reports it", async () => {
    mockMigrationStart.mockResolvedValue(refusedWith(DOLLAR_BALANCE_REFUSAL))

    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()

    expect(result.current.isRejected).toBe(true)
    expect(result.current.isStarted).toBe(false)
    expect(result.current.hasConnectionIssue).toBe(false)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration start rejected",
      expect.objectContaining({ message: DOLLAR_BALANCE_REFUSAL }),
    )
  })

  it("treats a thrown server error as final", async () => {
    mockMigrationStart.mockRejectedValue(new Error("boom"))

    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()

    expect(result.current.isRejected).toBe(true)
    expect(result.current.hasConnectionIssue).toBe(false)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration start failed",
      expect.any(Error),
    )
  })

  /** A start the network never delivered can still succeed, so it must not hand the user
   *  to support, and support must never hear about it. */
  it("treats a network failure as retryable and never reports it", async () => {
    mockMigrationStart.mockRejectedValue(networkFailure())

    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()

    expect(result.current.hasConnectionIssue).toBe(true)
    expect(result.current.isRejected).toBe(false)
    expect(result.current.isStarted).toBe(false)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("fires again when a retry follows a network failure", async () => {
    mockMigrationStart.mockRejectedValueOnce(networkFailure())

    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()
    expect(result.current.hasConnectionIssue).toBe(true)

    act(() => result.current.retry())
    await flushEffects()

    expect(mockMigrationStart).toHaveBeenCalledTimes(2)
    expect(result.current.isStarted).toBe(true)
    expect(result.current.hasConnectionIssue).toBe(false)
  })

  /** A refusal is final, so retrying it would only replay the same answer. */
  it("does not fire again when a retry follows a refusal", async () => {
    mockMigrationStart.mockResolvedValue(refusedWith(DOLLAR_BALANCE_REFUSAL))

    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()

    act(() => result.current.retry())
    await flushEffects()

    expect(mockMigrationStart).toHaveBeenCalledTimes(1)
  })

  /** An accepted start is settled too: re-firing it would re-arm an already-armed lock. */
  it("does not fire again when a retry follows an accepted start", async () => {
    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()
    expect(result.current.isStarted).toBe(true)

    act(() => result.current.retry())
    await flushEffects()

    expect(mockMigrationStart).toHaveBeenCalledTimes(1)
  })

  /** A settled response with no payload is not a started migration: the answer never
   *  arrived, so it earns the shared retry rather than arming the lock on no answer. */
  it("treats a settled response with no payload as a retryable connection issue", async () => {
    mockMigrationStart.mockResolvedValue({ data: undefined })

    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()

    expect(result.current.hasConnectionIssue).toBe(true)
    expect(result.current.isStarted).toBe(false)
    expect(result.current.isRejected).toBe(false)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration start empty payload",
      expect.any(Error),
    )
  })

  it("fires again when a retry follows an empty payload", async () => {
    mockMigrationStart.mockResolvedValueOnce({ data: undefined })

    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()
    expect(result.current.hasConnectionIssue).toBe(true)

    act(() => result.current.retry())
    await flushEffects()

    expect(mockMigrationStart).toHaveBeenCalledTimes(2)
    expect(result.current.isStarted).toBe(true)
    expect(result.current.hasConnectionIssue).toBe(false)
  })

  /** A payload present but without an errors array is a started migration, not a failure. */
  it("treats a payload with no errors array as started", async () => {
    mockMigrationStart.mockResolvedValue({ data: { migrationStart: {} } })

    const { result } = renderHook(() => useEnsureMigrationStarted({ skip: false }))
    await flushEffects()

    expect(result.current.isStarted).toBe(true)
    expect(result.current.isRejected).toBe(false)
  })

  /** A rejection that arrives after the screen has left is still worth logging, so the
   *  report fires before the unmount guard; only the state write the guard protects is
   *  dropped. Moving reportError below the guard would silence it here. */
  it("still reports a rejection that arrives after the screen has left", async () => {
    let settle: (value: unknown) => void = () => undefined
    mockMigrationStart.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )

    const { result, unmount } = renderHook(() =>
      useEnsureMigrationStarted({ skip: false }),
    )
    unmount()

    await act(async () => {
      settle(refusedWith(DOLLAR_BALANCE_REFUSAL))
    })

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration start rejected",
      expect.objectContaining({ message: DOLLAR_BALANCE_REFUSAL }),
    )
    expect(result.current.isRejected).toBe(false)
  })

  it("drops the failure when the screen leaves before the error arrives", async () => {
    let fail: (reason: unknown) => void = () => undefined
    mockMigrationStart.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject
      }),
    )

    const { result, unmount } = renderHook(() =>
      useEnsureMigrationStarted({ skip: false }),
    )
    unmount()

    await act(async () => {
      fail(networkFailure())
    })

    expect(result.current.hasConnectionIssue).toBe(false)
  })
})
