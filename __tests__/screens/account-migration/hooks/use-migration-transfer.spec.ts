import { renderHook } from "@testing-library/react-native"

import { MigrationStatus } from "@app/graphql/generated"
import { useMigrationTransfer } from "@app/screens/account-migration/hooks/use-migration-transfer"
import { MigrationTransferRequestStatus } from "@app/self-custodial/migration-transfer-request"
import { MigrationSupportReason } from "@app/types/migration"

import { flushEffects } from "../../../helpers/flush-effects"

const mockBuildTransferRequest = jest.fn()
const mockCommitMigration = jest.fn()
const mockReportError = jest.fn()
let mockStatus: MigrationStatus | null = MigrationStatus.InProgress

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationCommitMutation: () => [mockCommitMigration],
}))

const mockUseMigrationStatus = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-migration-status", () => ({
  useMigrationStatus: (options: unknown) => {
    mockUseMigrationStatus(options)
    return { status: mockStatus, loading: false, isSkipped: false }
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

const collectedRequest = {
  sparkInvoice: "lnbcrt1invoice",
  sparkPubkey: "03abc",
  proofSignature: "deadbeef",
}

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
    mockStatus = MigrationStatus.InProgress
    mockBuildTransferRequest.mockResolvedValue({
      status: MigrationTransferRequestStatus.Ok,
      request: collectedRequest,
    })
    mockCommitMigration.mockResolvedValue({ data: { migrationCommit: { errors: [] } } })
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

  /** Reading `migration` runs the server's resume routine every time, and this hook's
   *  screen stays mounted under the one it hands over to. */
  it("watches the phase while the transfer is still moving", async () => {
    renderTransfer()
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenLastCalledWith({ pollInterval: 2000 })
  })

  it("stops watching once the phase settles", async () => {
    mockStatus = MigrationStatus.Completed
    renderTransfer()
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenLastCalledWith({ pollInterval: undefined })
  })

  it("stops watching a transfer the server failed", async () => {
    mockStatus = MigrationStatus.Failed
    renderTransfer()
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenLastCalledWith({ pollInterval: undefined })
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
      status: MigrationTransferRequestStatus.NoMnemonic,
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
      status: MigrationTransferRequestStatus.Failed,
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

  it("hands a commit that threw to support", async () => {
    mockCommitMigration.mockRejectedValue(new Error("network down"))
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.failureReason).toBe(MigrationSupportReason.TransferFailed)
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
})
