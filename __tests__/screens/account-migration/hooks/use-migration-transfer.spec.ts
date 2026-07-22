import { act, renderHook } from "@testing-library/react-native"

import { MigrationStatus } from "@app/graphql/generated"
import {
  resetMigrationCommitGuard,
  useMigrationTransfer,
} from "@app/screens/account-migration/hooks/use-migration-transfer"
import { MigrationSdkStatus } from "@app/self-custodial/migration-transfer-request"
import { MigrationSupportReason } from "@app/types/migration"

import { flushEffects } from "../../../helpers/flush-effects"

const mockBuildTransferRequest = jest.fn()
const mockCommitMigration = jest.fn()
const mockReportError = jest.fn()
const mockIsDeviceClockSkewed = jest.fn()
const mockCurrentProofTimestamp = jest.fn()
let mockStatus: MigrationStatus | null = MigrationStatus.InProgress

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationCommitMutation: () => [mockCommitMigration],
}))

const mockUseMigrationStatus = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-migration-status", () => ({
  useMigrationStatus: (options: unknown) => {
    mockUseMigrationStatus(options)
    return { status: mockStatus, loading: false }
  },
}))

jest.mock("@app/self-custodial/migration-transfer-request", () => ({
  ...jest.requireActual("@app/self-custodial/migration-transfer-request"),
  buildMigrationTransferRequest: (args: unknown) => mockBuildTransferRequest(args),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({ selfCustodialDepositClaimLeewayVbyte: 1 }),
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

jest.mock("@app/graphql/server-time", () => ({
  isDeviceClockSkewed: () => mockIsDeviceClockSkewed(),
}))

jest.mock("@app/screens/account-migration/utils/migration-proof", () => ({
  ...jest.requireActual("@app/screens/account-migration/utils/migration-proof"),
  currentProofTimestamp: () => mockCurrentProofTimestamp(),
}))

const collectedRequest = {
  sparkInvoice: "lnbcrt1invoice",
  sparkPubkey: "03abc",
  proofSignature: "deadbeef",
}

/** A dropped connection: an Apollo error carrying a truthy networkError, the same shape
 *  isNetworkFailure keys on, as opposed to a plain throw the server actually answered. */
const networkError = () =>
  Object.assign(new Error("offline"), { networkError: new Error("net") })

const renderTransfer = (
  overrides: Partial<Parameters<typeof useMigrationTransfer>[0]> = {},
) =>
  renderHook(() =>
    useMigrationTransfer({
      custodialAccountId: "custodial-1",
      selfCustodialAccountId: "sc-account-1",
      skip: false,
      ...overrides,
    }),
  )

describe("useMigrationTransfer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMigrationCommitGuard()
    mockStatus = MigrationStatus.InProgress
    mockBuildTransferRequest.mockResolvedValue({
      status: MigrationSdkStatus.Ok,
      value: collectedRequest,
    })
    mockCommitMigration.mockResolvedValue({ data: { migrationCommit: { errors: [] } } })
    mockIsDeviceClockSkewed.mockReturnValue(false)
    mockCurrentProofTimestamp.mockReturnValue(1_700_000_000)
  })

  it("commits the collected destination while the server awaits one", async () => {
    renderTransfer()
    await flushEffects()

    expect(mockCommitMigration).toHaveBeenCalledWith({
      variables: {
        input: {
          ...collectedRequest,
          proofTimestamp: expect.any(Number),
          backupAttested: true,
          disclosureVersion: "v1",
        },
      },
    })
  })

  /** The proof and the commit have to name the same moment, or the backend measures the
   *  freshness window against a timestamp it was never given. */
  it("signs and commits with one timestamp", async () => {
    renderTransfer()
    await flushEffects()

    const { signChallenge } = mockBuildTransferRequest.mock.calls[0][0]
    const { proofTimestamp } = mockCommitMigration.mock.calls[0][0].variables.input

    expect(signChallenge("03abc")).toBe(`migrate:custodial-1-03abc-${proofTimestamp}`)
  })

  /**
   * The decisive case for a relaunch mid-transfer: the commit is single-shot server-side,
   * so a flow already TRANSFERRING must only be watched. Re-committing would send a
   * second invoice the backend refuses as a state conflict.
   */
  it("only watches a transfer already under way", async () => {
    mockStatus = MigrationStatus.Transferring
    renderTransfer()
    await flushEffects()

    expect(mockBuildTransferRequest).not.toHaveBeenCalled()
    expect(mockCommitMigration).not.toHaveBeenCalled()
  })

  it("commits once, however often it re-renders", async () => {
    const { rerender } = renderTransfer()
    await flushEffects()
    rerender({})
    rerender({})
    await flushEffects()

    expect(mockCommitMigration).toHaveBeenCalledTimes(1)
  })

  /** A per-mount ref would reset on a remount; the module guard does not, so a screen that
   *  re-mounts while the first commit is still in flight never sends a second invoice the
   *  backend would refuse as a state conflict. */
  it("commits once for an account even across a remount", async () => {
    const first = renderTransfer()
    await flushEffects()
    first.unmount()

    renderTransfer()
    await flushEffects()

    expect(mockCommitMigration).toHaveBeenCalledTimes(1)
  })

  /** The failure outcome outlives a remount the way the commit guard does: a screen
   *  re-entered after support restores the reason and routes back to support, rather than
   *  blocking the re-commit and spinning with nothing to show. */
  it("restores a settled failure across a remount instead of spinning", async () => {
    mockCommitMigration.mockResolvedValue({
      data: { migrationCommit: { errors: [{ message: "refused" }] } },
    })
    const first = renderTransfer()
    await flushEffects()
    expect(first.result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
    first.unmount()

    const second = renderTransfer()
    await flushEffects()

    expect(second.result.current.failureReason).toBe(
      MigrationSupportReason.TransferFailed,
    )
    expect(mockCommitMigration).toHaveBeenCalledTimes(1)
  })

  /** The owner id often resolves a tick after mount; the remembered failure is restored as
   *  soon as it does, so a late id cannot leave the re-entered screen spinning either. */
  it("restores the remembered failure once the custodial account id arrives", async () => {
    mockCommitMigration.mockResolvedValue({
      data: { migrationCommit: { errors: [{ message: "refused" }] } },
    })
    const first = renderTransfer()
    await flushEffects()
    first.unmount()

    const { result, rerender } = renderHook(
      ({ custodialAccountId }: { custodialAccountId: string | null }) =>
        useMigrationTransfer({
          custodialAccountId,
          selfCustodialAccountId: "sc-account-1",
          skip: false,
        }),
      { initialProps: { custodialAccountId: null as string | null } },
    )
    await flushEffects()
    expect(result.current.failureReason).toBeNull()

    rerender({ custodialAccountId: "custodial-1" })
    await flushEffects()

    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
    expect(mockCommitMigration).toHaveBeenCalledTimes(1)
  })

  it("does not commit while the caller is skipping", async () => {
    renderTransfer({ skip: true })
    await flushEffects()

    expect(mockCommitMigration).not.toHaveBeenCalled()
  })

  it("does not commit without a provisioned account to pay into", async () => {
    renderTransfer({ selfCustodialAccountId: null })
    await flushEffects()

    expect(mockBuildTransferRequest).not.toHaveBeenCalled()
  })

  /** A transiently null account id must not consume the single-shot commit: the guard is
   *  in shouldCommit, so the commit still fires once the id arrives rather than being
   *  latched out forever. */
  it("commits once the custodial account id arrives, not before", async () => {
    const { rerender } = renderHook(
      ({ custodialAccountId }: { custodialAccountId: string | null }) =>
        useMigrationTransfer({
          custodialAccountId,
          selfCustodialAccountId: "sc-account-1",
          skip: false,
        }),
      { initialProps: { custodialAccountId: null as string | null } },
    )
    await flushEffects()
    expect(mockCommitMigration).not.toHaveBeenCalled()

    rerender({ custodialAccountId: "custodial-1" })
    await flushEffects()

    expect(mockCommitMigration).toHaveBeenCalledTimes(1)
  })

  /** Reading `migration` runs the server's resume routine every time, and this hook's
   *  screen stays mounted under the one it hands over to. */
  it("watches the phase while the transfer is still moving", async () => {
    renderTransfer()
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenLastCalledWith({
      skip: false,
      pollInterval: 2000,
    })
  })

  /** pollInterval 0, not undefined: Apollo drops an undefined option in its merge and
   *  keeps polling, where 0 clears the timer. */
  it("stops watching once the phase settles", async () => {
    mockStatus = MigrationStatus.Completed
    renderTransfer()
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenLastCalledWith({
      skip: false,
      pollInterval: 0,
    })
  })

  it("stops watching a transfer the server failed", async () => {
    mockStatus = MigrationStatus.Failed
    renderTransfer()
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenLastCalledWith({
      skip: false,
      pollInterval: 0,
    })
  })

  /** A client-side failure hands the user to support; the poll must stop too, or a later
   *  COMPLETED would swap the session out from under that screen. */
  it("stops watching once a client-side failure is recorded", async () => {
    mockBuildTransferRequest.mockResolvedValue({
      status: MigrationSdkStatus.Failed,
      error: new Error("signer unavailable"),
    })
    renderTransfer()
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenLastCalledWith({
      skip: false,
      pollInterval: 0,
    })
  })

  /** The poll is silenced entirely while the caller is skipping, not just throttled. */
  it("does not watch the phase while the caller is skipping", async () => {
    renderTransfer({ skip: true })
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  /** A COMPLETED that arrives after a failure must not report the transfer as done, or
   *  the screen swaps the session while the user sits on the support screen. */
  it("does not report done once a failure has handed over to support", async () => {
    mockStatus = MigrationStatus.InProgress
    mockCommitMigration.mockResolvedValue({
      data: { migrationCommit: { errors: [{ message: "refused" }] } },
    })
    const { result, rerender } = renderTransfer()
    await flushEffects()
    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)

    /** The server nonetheless reaches COMPLETED and a stray poll observes it. */
    mockStatus = MigrationStatus.Completed
    rerender({})
    await flushEffects()

    expect(result.current.isTransferred).toBe(false)
    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
  })

  it("reports the transfer done once the server says so", async () => {
    mockStatus = MigrationStatus.Completed
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isTransferred).toBe(true)
    expect(result.current.failureReason).toBeNull()
  })

  /** FAILED has no client-side way back: the phase machine only leaves it when a late
   *  payment settles server-side, so a retry would loop on a refusal. */
  it("hands a server-side failure to support", async () => {
    mockStatus = MigrationStatus.Failed
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
    expect(result.current.isTransferred).toBe(false)
  })

  it("names the missing wallet when the device has no mnemonic for it", async () => {
    mockBuildTransferRequest.mockResolvedValue({
      status: MigrationSdkStatus.NoMnemonic,
    })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.failureReason).toBe(
      MigrationSupportReason.SelfCustodialAccountMissing,
    )
    expect(mockCommitMigration).not.toHaveBeenCalled()
  })

  it("hands a wallet that would not produce a destination to support", async () => {
    mockBuildTransferRequest.mockResolvedValue({
      status: MigrationSdkStatus.Failed,
      error: new Error("signer unavailable"),
    })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
    expect(mockCommitMigration).not.toHaveBeenCalled()
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration transfer",
      expect.objectContaining({ message: "signer unavailable" }),
    )
  })

  /** A dropped connection while collecting the destination is retryable, not settled: it
   *  pauses on the shared retry rather than handing the user to support. */
  it("pauses on the shared retry when the destination connect drops", async () => {
    mockBuildTransferRequest.mockResolvedValue({
      status: MigrationSdkStatus.ConnectionError,
      error: new Error("connection reset"),
    })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.hasConnectionIssue).toBe(true)
    expect(result.current.failureReason).toBeNull()
    expect(mockCommitMigration).not.toHaveBeenCalled()
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("recommits after a destination connect error once the user retries", async () => {
    mockBuildTransferRequest
      .mockResolvedValueOnce({
        status: MigrationSdkStatus.ConnectionError,
        error: new Error("connection reset"),
      })
      .mockResolvedValue({ status: MigrationSdkStatus.Ok, value: collectedRequest })
    const { result } = renderTransfer()
    await flushEffects()
    expect(result.current.hasConnectionIssue).toBe(true)

    act(() => result.current.retry())
    await flushEffects()

    expect(mockCommitMigration).toHaveBeenCalledTimes(1)
    expect(result.current.hasConnectionIssue).toBe(false)
  })

  it("hands a commit the server refused to support", async () => {
    mockCommitMigration.mockResolvedValue({
      data: { migrationCommit: { errors: [{ message: "invoice is expired" }] } },
    })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration transfer",
      expect.objectContaining({ message: "invoice is expired" }),
    )
  })

  /** A throw the server actually answered (no networkError on it) is a real failure, not a
   *  dropped connection, so it hands over to support rather than offering a retry. */
  it("hands a commit that failed for a non-network reason to support", async () => {
    mockCommitMigration.mockRejectedValue(new Error("boom"))
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
    expect(result.current.hasConnectionIssue).toBe(false)
  })

  /** A commit lost to the network is the one throw that is not a settled failure: it may
   *  still have landed, so it offers the shared retry and support never hears about it,
   *  exactly as the start and ln-address steps already do. */
  it("offers a retry instead of support when the commit is lost to the network", async () => {
    mockCommitMigration.mockRejectedValue(networkError())
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.hasConnectionIssue).toBe(true)
    expect(result.current.failureReason).toBeNull()
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("recommits on retry once the connection is back", async () => {
    mockCommitMigration.mockRejectedValueOnce(networkError())
    const { result } = renderTransfer()
    await flushEffects()
    expect(result.current.hasConnectionIssue).toBe(true)

    act(() => result.current.retry())
    await flushEffects()

    expect(mockCommitMigration).toHaveBeenCalledTimes(2)
    expect(result.current.hasConnectionIssue).toBe(false)
    expect(result.current.failureReason).toBeNull()
  })

  /** The property that lets a lost connection retry safely: if the commit actually landed
   *  (the drop hit the response), the phase advances to TRANSFERRING, the notice clears,
   *  and the retry only watches it, never sending a second invoice the backend refuses. */
  it("does not recommit once the phase has advanced past the commit", async () => {
    mockCommitMigration.mockRejectedValue(networkError())
    const { result, rerender } = renderTransfer()
    await flushEffects()
    expect(result.current.hasConnectionIssue).toBe(true)

    mockStatus = MigrationStatus.Transferring
    rerender({})
    await flushEffects()
    expect(result.current.hasConnectionIssue).toBe(false)

    act(() => result.current.retry())
    await flushEffects()

    expect(mockCommitMigration).toHaveBeenCalledTimes(1)
  })

  it("survives a commit payload with no errors array", async () => {
    mockCommitMigration.mockResolvedValue({ data: undefined })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.failureReason).toBeNull()
  })

  it("does not commit again after a failure", async () => {
    mockCommitMigration.mockResolvedValue({
      data: { migrationCommit: { errors: [{ message: "refused" }] } },
    })
    const { rerender } = renderTransfer()
    await flushEffects()
    rerender({})
    await flushEffects()

    expect(mockCommitMigration).toHaveBeenCalledTimes(1)
  })

  /** A proof the backend rejects because the device clock sits outside its freshness
   *  window is the user's to fix — flagged by that collapsed code AND a measurably skewed
   *  clock — so it earns a retry rather than reporting an error and handing over to
   *  support. */
  it("flags a clock skew instead of handing a stale proof to support", async () => {
    mockIsDeviceClockSkewed.mockReturnValue(true)
    mockCommitMigration.mockResolvedValue({
      data: {
        migrationCommit: {
          errors: [
            { message: "invalid destination", code: "MIGRATION_INVALID_DESTINATION" },
          ],
        },
      },
    })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isClockOutOfSync).toBe(true)
    expect(result.current.failureReason).toBeNull()
    expect(mockReportError).not.toHaveBeenCalled()
  })

  /** The device heuristic must not hijack an unrelated failure: a rejection under a
   *  different code is a genuine problem for support even on a skewed clock. */
  it("hands a non-proof rejection to support even when the clock is skewed", async () => {
    mockIsDeviceClockSkewed.mockReturnValue(true)
    mockCommitMigration.mockResolvedValue({
      data: {
        migrationCommit: {
          errors: [{ message: "state conflict", code: "MIGRATION_STATE_CONFLICT" }],
        },
      },
    })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isClockOutOfSync).toBe(false)
    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
  })

  /** The same collapsed code with a healthy clock is a genuinely invalid destination, not
   *  a stale proof, so it belongs with support. */
  it("hands a genuine invalid destination to support when the clock is healthy", async () => {
    mockIsDeviceClockSkewed.mockReturnValue(false)
    mockCommitMigration.mockResolvedValue({
      data: {
        migrationCommit: {
          errors: [{ message: "bad invoice", code: "MIGRATION_INVALID_DESTINATION" }],
        },
      },
    })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isClockOutOfSync).toBe(false)
    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
  })

  /** Out of sync there is nothing to poll for until the retry fires a fresh commit, so the
   *  phase read is paused rather than re-running the server's resume routine every 2s. */
  it("pauses the phase poll while the clock is out of sync", async () => {
    mockIsDeviceClockSkewed.mockReturnValue(true)
    mockCommitMigration.mockResolvedValue({
      data: {
        migrationCommit: {
          errors: [{ message: "stale", code: "MIGRATION_INVALID_DESTINATION" }],
        },
      },
    })
    renderTransfer()
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenLastCalledWith({
      skip: false,
      pollInterval: 0,
    })
  })

  /** The retry screen and the support handover are mutually exclusive: a server failure
   *  landing while out of sync must not also route to support behind the retry. */
  it("suppresses the support handover while the clock is out of sync", async () => {
    mockIsDeviceClockSkewed.mockReturnValue(true)
    mockCommitMigration.mockResolvedValue({
      data: {
        migrationCommit: {
          errors: [{ message: "stale", code: "MIGRATION_INVALID_DESTINATION" }],
        },
      },
    })
    const { result, rerender } = renderTransfer()
    await flushEffects()
    expect(result.current.isClockOutOfSync).toBe(true)

    mockStatus = MigrationStatus.Failed
    rerender({})
    await flushEffects()

    expect(result.current.isClockOutOfSync).toBe(true)
    expect(result.current.failureReason).toBeNull()
  })

  it("commits again with a fresh timestamp once the user retries", async () => {
    mockCurrentProofTimestamp
      .mockReturnValueOnce(1_700_000_000)
      .mockReturnValueOnce(1_700_000_060)
    mockIsDeviceClockSkewed.mockReturnValue(true)
    mockCommitMigration.mockResolvedValue({
      data: {
        migrationCommit: {
          errors: [{ message: "stale", code: "MIGRATION_INVALID_DESTINATION" }],
        },
      },
    })
    const { result } = renderTransfer()
    await flushEffects()
    expect(result.current.isClockOutOfSync).toBe(true)

    mockIsDeviceClockSkewed.mockReturnValue(false)
    mockCommitMigration.mockResolvedValue({ data: { migrationCommit: { errors: [] } } })
    act(() => result.current.retry())
    await flushEffects()

    const firstTimestamp =
      mockCommitMigration.mock.calls[0][0].variables.input.proofTimestamp
    const secondTimestamp =
      mockCommitMigration.mock.calls[1][0].variables.input.proofTimestamp
    expect(firstTimestamp).toBe(1_700_000_000)
    expect(secondTimestamp).toBe(1_700_000_060)
    expect(result.current.isClockOutOfSync).toBe(false)
  })

  it("retries without a spurious commit when there is no custodial account id", async () => {
    const { result } = renderTransfer({ custodialAccountId: null })
    await flushEffects()

    act(() => result.current.retry())

    expect(mockCommitMigration).not.toHaveBeenCalled()
  })
})
