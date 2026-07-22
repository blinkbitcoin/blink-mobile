import { act, renderHook } from "@testing-library/react-native"

import { MigrationLnAddressTransferStatus } from "@app/graphql/generated"
import { useMigrationLnAddressTransfer } from "@app/screens/account-migration/hooks/use-migration-ln-address-transfer"
import { MigrationSdkStatus } from "@app/self-custodial/migration-transfer-request"

import { flushEffects } from "../../../helpers/flush-effects"

const mockBuildProof = jest.fn()
const mockTransfer = jest.fn()
const mockReportError = jest.fn()
const mockCurrentProofTimestamp = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useMigrationLnAddressTransferMutation: () => [mockTransfer],
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({ selfCustodialDepositClaimLeewayVbyte: 1 }),
}))

jest.mock("@app/self-custodial/migration-transfer-request", () => ({
  ...jest.requireActual("@app/self-custodial/migration-transfer-request"),
  buildMigrationLnAddressProof: (args: unknown) => mockBuildProof(args),
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

jest.mock("@app/screens/account-migration/utils/migration-proof", () => ({
  ...jest.requireActual("@app/screens/account-migration/utils/migration-proof"),
  currentProofTimestamp: () => mockCurrentProofTimestamp(),
}))

const okProof = {
  status: MigrationSdkStatus.Ok,
  value: { sparkPubkey: "03abc", proofSignature: "deadbeef" },
}

const payload = (
  results: { identifier: string; status: MigrationLnAddressTransferStatus }[],
  errors: { message: string }[] = [],
) => ({ data: { migrationLnAddressTransfer: { errors, results } } })

const networkError = () =>
  Object.assign(new Error("offline"), { networkError: new Error("net") })

const renderTransfer = (
  overrides: Partial<Parameters<typeof useMigrationLnAddressTransfer>[0]> = {},
) =>
  renderHook(() =>
    useMigrationLnAddressTransfer({
      custodialAccountId: "owner-1",
      selfCustodialAccountId: "sc-1",
      skip: false,
      ...overrides,
    }),
  )

describe("useMigrationLnAddressTransfer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBuildProof.mockResolvedValue(okProof)
    mockTransfer.mockResolvedValue(
      payload([
        { identifier: "user", status: MigrationLnAddressTransferStatus.Transferred },
      ]),
    )
    mockCurrentProofTimestamp.mockReturnValue(1_700_000_000)
  })

  it("signs the proof and calls the mutation with it", async () => {
    renderTransfer()
    await flushEffects()

    expect(mockTransfer).toHaveBeenCalledWith({
      variables: {
        input: {
          proofSignature: "deadbeef",
          proofTimestamp: expect.any(Number),
          sparkPubkey: "03abc",
        },
      },
    })
  })

  /** The backend verifies the proof against the real Galoy account id, so the challenge
   *  must name the custodial owner id, not the registry's shared placeholder. */
  it("builds the challenge from the custodial owner id and the wallet pubkey", async () => {
    renderTransfer()
    await flushEffects()

    const { signChallenge } = mockBuildProof.mock.calls[0][0]
    expect(signChallenge("03abc")).toMatch(/^migrate:owner-1-03abc-\d+$/)
  })

  /** The signed challenge and the mutation must name the same moment, or the backend
   *  measures the freshness window against a timestamp it was never given. A second call
   *  to currentProofTimestamp would surface here as a mismatch. */
  it("signs and commits against a single timestamp", async () => {
    mockCurrentProofTimestamp
      .mockReturnValueOnce(1_700_000_000)
      .mockReturnValueOnce(2_700_000_000)
    renderTransfer()
    await flushEffects()

    const challenge = mockBuildProof.mock.calls[0][0].signChallenge("03abc")
    const { proofTimestamp } = mockTransfer.mock.calls[0][0].variables.input
    expect(challenge).toBe(`migrate:owner-1-03abc-${proofTimestamp}`)
  })

  it("settles as transferred once every identifier moved", async () => {
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isTransferred).toBe(true)
    expect(result.current.isRejected).toBe(false)
  })

  /** Nothing left to move is still a settled outcome, not a failure. */
  it("treats already-transferred and skipped identifiers as settled", async () => {
    mockTransfer.mockResolvedValue(
      payload([
        {
          identifier: "user",
          status: MigrationLnAddressTransferStatus.AlreadyTransferred,
        },
        {
          identifier: "phone",
          status: MigrationLnAddressTransferStatus.SkippedNotRegistered,
        },
      ]),
    )
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isTransferred).toBe(true)
  })

  /** No identifiers to move is a settled success; a missing payload is not — it is an
   *  unverified transfer that must not unlock the commit. */
  it("settles as transferred when there is nothing to move", async () => {
    mockTransfer.mockResolvedValue(payload([]))
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isTransferred).toBe(true)
  })

  it("hands an empty payload to support rather than a false success", async () => {
    mockTransfer.mockResolvedValue({ data: undefined })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isRejected).toBe(true)
    expect(result.current.isTransferred).toBe(false)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration ln-address empty payload",
      expect.any(Error),
    )
  })

  it("hands a proof with no mnemonic to support without calling the mutation", async () => {
    mockBuildProof.mockResolvedValue({ status: MigrationSdkStatus.NoMnemonic })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isRejected).toBe(true)
    expect(mockTransfer).not.toHaveBeenCalled()
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration ln-address proof",
      expect.any(Error),
    )
  })

  it("hands a failed proof to support", async () => {
    mockBuildProof.mockResolvedValue({
      status: MigrationSdkStatus.Failed,
      error: new Error("sdk down"),
    })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isRejected).toBe(true)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration ln-address proof",
      expect.objectContaining({ message: "sdk down" }),
    )
  })

  /** A dropped connection while signing the proof is retryable, not settled: it offers the
   *  shared retry rather than handing over, and support never hears about it. */
  it("marks a connection error during the proof as a retryable connection issue", async () => {
    mockBuildProof.mockResolvedValue({
      status: MigrationSdkStatus.ConnectionError,
      error: new Error("connection reset"),
    })
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.hasConnectionIssue).toBe(true)
    expect(result.current.isRejected).toBe(false)
    expect(mockTransfer).not.toHaveBeenCalled()
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("retries after a proof connection error and can then settle", async () => {
    mockBuildProof
      .mockResolvedValueOnce({
        status: MigrationSdkStatus.ConnectionError,
        error: new Error("connection reset"),
      })
      .mockResolvedValue(okProof)
    const { result } = renderTransfer()
    await flushEffects()
    expect(result.current.hasConnectionIssue).toBe(true)

    act(() => result.current.retry())
    await flushEffects()

    expect(result.current.isTransferred).toBe(true)
    expect(mockTransfer).toHaveBeenCalledTimes(1)
  })

  it("hands a top-level rejection to support", async () => {
    mockTransfer.mockResolvedValue(payload([], [{ message: "flag off" }]))
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isRejected).toBe(true)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration ln-address rejected",
      expect.objectContaining({ message: "flag off" }),
    )
  })

  it("hands a FAILED identifier to support", async () => {
    mockTransfer.mockResolvedValue(
      payload([{ identifier: "user", status: MigrationLnAddressTransferStatus.Failed }]),
    )
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isRejected).toBe(true)
  })

  it("marks a dropped network as a connection issue, not a rejection", async () => {
    mockTransfer.mockRejectedValue(networkError())
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.hasConnectionIssue).toBe(true)
    expect(result.current.isRejected).toBe(false)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("hands a non-network throw to support", async () => {
    mockTransfer.mockRejectedValue(new Error("boom"))
    const { result } = renderTransfer()
    await flushEffects()

    expect(result.current.isRejected).toBe(true)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration ln-address failed",
      expect.any(Error),
    )
  })

  it("does not fire while the caller is skipping", async () => {
    renderTransfer({ skip: true })
    await flushEffects()

    expect(mockBuildProof).not.toHaveBeenCalled()
  })

  it("waits for both account ids before firing", async () => {
    const { rerender } = renderHook(
      ({ custodialAccountId }: { custodialAccountId: string | null }) =>
        useMigrationLnAddressTransfer({
          custodialAccountId,
          selfCustodialAccountId: "sc-1",
          skip: false,
        }),
      { initialProps: { custodialAccountId: null as string | null } },
    )
    await flushEffects()
    expect(mockBuildProof).not.toHaveBeenCalled()

    rerender({ custodialAccountId: "owner-1" })
    await flushEffects()

    expect(mockBuildProof).toHaveBeenCalledTimes(1)
  })

  it("fires once however often it re-renders", async () => {
    const { rerender } = renderTransfer()
    await flushEffects()
    rerender({})
    await flushEffects()

    expect(mockTransfer).toHaveBeenCalledTimes(1)
  })

  it("retries a connection issue with a fresh attempt", async () => {
    mockTransfer.mockRejectedValueOnce(networkError())
    const { result } = renderTransfer()
    await flushEffects()
    expect(result.current.hasConnectionIssue).toBe(true)

    act(() => result.current.retry())
    await flushEffects()

    expect(mockTransfer).toHaveBeenCalledTimes(2)
    expect(result.current.isTransferred).toBe(true)
  })

  /** A superseded attempt — retried (via the screen's shared retry) while its first run was
   *  still in flight — must not apply its late outcome over the newer one; the isActive
   *  cleanup guard drops it. */
  it("drops a superseded attempt's late outcome", async () => {
    let resolveFirstProof: (result: unknown) => void = () => {}
    mockBuildProof
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstProof = resolve
        }),
      )
      .mockResolvedValue(okProof)

    const { result } = renderTransfer()
    await flushEffects()
    expect(result.current.isTransferred).toBe(false)

    act(() => result.current.retry())
    await flushEffects()
    expect(result.current.isTransferred).toBe(true)

    await act(async () => {
      resolveFirstProof({ status: MigrationSdkStatus.NoMnemonic })
      await flushEffects()
    })

    expect(result.current.isTransferred).toBe(true)
    expect(result.current.isRejected).toBe(false)
  })

  /** The shared retry button fires every source; a completed re-point must not re-run the
   *  expensive connect-and-sign for a source that already settled. */
  it("does not re-fire a completed transfer on a shared retry", async () => {
    const { result } = renderTransfer()
    await flushEffects()
    expect(result.current.isTransferred).toBe(true)

    act(() => result.current.retry())
    await flushEffects()

    expect(mockTransfer).toHaveBeenCalledTimes(1)
  })

  it("does not retry a settled rejection", async () => {
    mockTransfer.mockResolvedValue(payload([], [{ message: "flag off" }]))
    const { result } = renderTransfer()
    await flushEffects()
    expect(result.current.isRejected).toBe(true)

    act(() => result.current.retry())
    await flushEffects()

    expect(mockTransfer).toHaveBeenCalledTimes(1)
  })
})
