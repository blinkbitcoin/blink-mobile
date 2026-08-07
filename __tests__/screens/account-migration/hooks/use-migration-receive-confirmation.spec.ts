import { act, renderHook } from "@testing-library/react-native"

import { useMigrationReceiveConfirmation } from "@app/screens/account-migration/hooks/use-migration-receive-confirmation"
import { MigrationSdkStatus } from "@app/self-custodial/migration-transfer-request"

const mockCheckReceiveLanded = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/self-custodial/migration-transfer-request", () => ({
  ...jest.requireActual("@app/self-custodial/migration-transfer-request"),
  checkMigrationReceiveLanded: (args: unknown) => mockCheckReceiveLanded(args),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

const DELAYED_NOTICE_MS = 60_000

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({
    selfCustodialDepositClaimLeewayVbyte: 1,
    migrationReceiveDelayedNoticeMs: 60_000,
  }),
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

const landed = { hasReceived: true, balanceSats: 21000 }
const stillEmpty = { hasReceived: false, balanceSats: 0 }

const ok = (value: typeof landed) => ({ status: MigrationSdkStatus.Ok, value })

const renderGate = (
  overrides: Partial<Parameters<typeof useMigrationReceiveConfirmation>[0]> = {},
) =>
  renderHook(() =>
    useMigrationReceiveConfirmation({
      selfCustodialAccountId: "sc-account-1",
      expectedReceiveSats: 21000,
      skip: false,
      ...overrides,
    }),
  )

/** Lets the pending check's promise chain settle without moving the fake clock. */
const flushCheck = () =>
  act(async () => {
    await Promise.resolve()
  })

/** Moves the clock and lets whatever it released settle. */
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms)
    await Promise.resolve()
  })

describe("useMigrationReceiveConfirmation", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockCheckReceiveLanded.mockResolvedValue(ok(stillEmpty))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("does not touch the SDK while skipped", async () => {
    const { result } = renderGate({ skip: true })
    await flushCheck()

    expect(mockCheckReceiveLanded).not.toHaveBeenCalled()
    expect(result.current).toEqual({
      isReceiveConfirmed: false,
      isReceiveDelayed: false,
    })
  })

  it("does not touch the SDK without a provisioned account id", async () => {
    const { result } = renderGate({ selfCustodialAccountId: null })
    await flushCheck()

    expect(mockCheckReceiveLanded).not.toHaveBeenCalled()
    expect(result.current.isReceiveConfirmed).toBe(false)
  })

  /** Nothing will ever arrive for a zero-receive migration, so waiting on the wallet
   *  would strand the user forever. */
  it("confirms a zero-receive migration at once, without the SDK", async () => {
    const { result } = renderGate({ expectedReceiveSats: 0 })
    await flushCheck()

    expect(mockCheckReceiveLanded).not.toHaveBeenCalled()
    expect(result.current.isReceiveConfirmed).toBe(true)
  })

  it("confirms once the first check finds the funds landed", async () => {
    mockCheckReceiveLanded.mockResolvedValue(ok(landed))

    const { result } = renderGate()
    await flushCheck()

    expect(mockCheckReceiveLanded).toHaveBeenCalledWith({
      accountId: "sc-account-1",
      network: "regtest",
      leewaySatPerVbyte: 1,
    })
    expect(result.current.isReceiveConfirmed).toBe(true)
  })

  it("keeps checking until the funds land", async () => {
    mockCheckReceiveLanded
      .mockResolvedValueOnce(ok(stillEmpty))
      .mockResolvedValueOnce(ok(stillEmpty))
      .mockResolvedValue(ok(landed))

    const { result } = renderGate()
    await flushCheck()
    expect(result.current.isReceiveConfirmed).toBe(false)

    await advance(5000)
    expect(result.current.isReceiveConfirmed).toBe(false)

    await advance(5000)
    expect(result.current.isReceiveConfirmed).toBe(true)
    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(3)
  })

  /** An unknown expectation (a checkpoint saved before the field existed) waits like a
   *  funded one: it cannot be told apart from real funds in transit. */
  it("keeps waiting on a legacy checkpoint with no expected figure", async () => {
    const { result } = renderGate({ expectedReceiveSats: null })
    await flushCheck()

    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
    expect(result.current.isReceiveConfirmed).toBe(false)

    await advance(5000)
    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(2)
    expect(result.current.isReceiveConfirmed).toBe(false)
  })

  it("retries a dropped connection instead of surfacing it", async () => {
    mockCheckReceiveLanded
      .mockResolvedValueOnce({
        status: MigrationSdkStatus.ConnectionError,
        error: new Error("offline"),
      })
      .mockResolvedValue(ok(landed))

    const { result } = renderGate()
    await flushCheck()
    expect(result.current.isReceiveConfirmed).toBe(false)

    await advance(5000)
    expect(result.current.isReceiveConfirmed).toBe(true)
  })

  it("reports a settled failure once and keeps checking", async () => {
    mockCheckReceiveLanded
      .mockResolvedValueOnce({
        status: MigrationSdkStatus.Failed,
        error: new Error("info unavailable"),
      })
      .mockResolvedValueOnce({
        status: MigrationSdkStatus.Failed,
        error: new Error("info unavailable"),
      })
      .mockResolvedValue(ok(landed))

    const { result } = renderGate()
    await flushCheck()
    await advance(5000)
    await advance(5000)

    expect(result.current.isReceiveConfirmed).toBe(true)
    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration receive check",
      expect.objectContaining({ message: "info unavailable" }),
    )
  })

  /** The swap path already reads a missing wallet key and routes it to support; a gate
   *  that held the swap back would only hide that handover. */
  it("passes a missing mnemonic through as confirmed", async () => {
    mockCheckReceiveLanded.mockResolvedValue({ status: MigrationSdkStatus.NoMnemonic })

    const { result } = renderGate()
    await flushCheck()

    expect(result.current.isReceiveConfirmed).toBe(true)
  })

  /** The retry waits for the previous check to settle: checks serialize on the wallet's
   *  storage directory anyway, so stacking would only queue. */
  it("never overlaps checks while one is still in flight", async () => {
    mockCheckReceiveLanded.mockReturnValue(new Promise(() => {}))

    renderGate()
    await flushCheck()
    await advance(20_000)

    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
  })

  it("raises the delayed notice after the configured wait, still checking", async () => {
    const { result } = renderGate()
    await flushCheck()
    expect(result.current.isReceiveDelayed).toBe(false)

    await advance(DELAYED_NOTICE_MS)
    expect(result.current.isReceiveDelayed).toBe(true)

    const checksSoFar = mockCheckReceiveLanded.mock.calls.length
    await advance(5000)
    expect(mockCheckReceiveLanded.mock.calls.length).toBeGreaterThan(checksSoFar)
  })

  it("keeps the delayed notice down when the receive confirms in time", async () => {
    mockCheckReceiveLanded.mockResolvedValue(ok(landed))

    const { result } = renderGate()
    await flushCheck()

    await advance(DELAYED_NOTICE_MS)
    expect(result.current.isReceiveDelayed).toBe(false)
    expect(result.current.isReceiveConfirmed).toBe(true)
  })

  it("stops checking for good once confirmed", async () => {
    mockCheckReceiveLanded.mockResolvedValue(ok(landed))

    renderGate()
    await flushCheck()
    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)

    await advance(60_000)
    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
  })

  it("stops checking when unmounted mid-wait", async () => {
    const { unmount } = renderGate()
    await flushCheck()
    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)

    unmount()
    await advance(60_000)

    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
  })

  /** The keystore read sits before the SDK result shape exists, so it can reject rather
   *  than settle; the gate treats that like any other transient miss. */
  it("retries when the check itself rejects", async () => {
    mockCheckReceiveLanded
      .mockRejectedValueOnce(new Error("keystore locked"))
      .mockResolvedValue(ok(landed))

    const { result } = renderGate()
    await flushCheck()
    expect(result.current.isReceiveConfirmed).toBe(false)
    expect(mockReportError).toHaveBeenCalledTimes(1)

    await advance(5000)
    expect(result.current.isReceiveConfirmed).toBe(true)
  })
})
