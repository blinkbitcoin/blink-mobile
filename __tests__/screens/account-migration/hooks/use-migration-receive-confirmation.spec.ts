import { it } from "@jest/globals"
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
const RECEIVE_CHECK_RETRY_MS = 5000
const DELAYED_RETRY_MS = 30_000

const defaultRemoteConfig = {
  selfCustodialDepositClaimLeewayVbyte: 1,
  migrationReceiveDelayedNoticeMs: DELAYED_NOTICE_MS,
  migrationDelayedRedirectEnabled: false,
}
let mockRemoteConfig = { ...defaultRemoteConfig }

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => mockRemoteConfig,
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

const landed = { hasReceived: true, balanceSats: 21000 }
const stillEmpty = { hasReceived: false, balanceSats: 0 }

const ok = (value: typeof landed) => ({ status: MigrationSdkStatus.Ok, value })

type GateOverrides = Partial<Parameters<typeof useMigrationReceiveConfirmation>[0]>

/** Prop-driven so a test can rerender through the transitions production actually
 *  takes: mounted skipped, armed later, possibly re-skipped after a failure. */
const renderGate = (overrides: GateOverrides = {}) =>
  renderHook(
    (props: GateOverrides) =>
      useMigrationReceiveConfirmation({
        selfCustodialAccountId: "sc-account-1",
        expectedReceiveSats: 21000,
        skip: false,
        ...props,
      }),
    { initialProps: overrides },
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
    mockRemoteConfig = { ...defaultRemoteConfig }
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
      isReceiveProven: false,
      isReceiveDelayed: false,
      recheck: expect.any(Function),
    })
  })

  it("does not touch the SDK without a provisioned account id", async () => {
    const { result } = renderGate({ selfCustodialAccountId: null })
    await flushCheck()

    expect(mockCheckReceiveLanded).not.toHaveBeenCalled()
    expect(result.current.isReceiveConfirmed).toBe(false)
  })

  /** The sequence production always takes: the gate mounts skipped (server still
   *  TRANSFERRING) and arms only when COMPLETED arrives. The first check and the notice
   *  window must both start from that moment, not from mount. */
  it("starts checking and arms the notice once the caller stops skipping", async () => {
    const { result, rerender } = renderGate({ skip: true })
    await flushCheck()
    expect(mockCheckReceiveLanded).not.toHaveBeenCalled()

    rerender({ skip: false })
    await flushCheck()
    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
    expect(result.current.isReceiveConfirmed).toBe(false)

    await advance(DELAYED_NOTICE_MS)
    expect(result.current.isReceiveDelayed).toBe(true)
  })

  /** The reverse ordering of "confirms in time": the notice has already fired when the
   *  funds land. The screen must swap at once, not keep the "taking longer" copy up. */
  it("withdraws the delayed notice when the receive lands after it fired", async () => {
    const { result } = renderGate()
    await flushCheck()
    await advance(DELAYED_NOTICE_MS)
    expect(result.current.isReceiveDelayed).toBe(true)

    mockCheckReceiveLanded.mockResolvedValue(ok(landed))
    await advance(DELAYED_RETRY_MS)

    expect(result.current).toEqual({
      isReceiveConfirmed: true,
      isReceiveProven: true,
      isReceiveDelayed: false,
      recheck: expect.any(Function),
    })
  })

  /** A caller that re-skips (a late failure handed the user to support) must get an
   *  inert gate, not a notice minted for a swap that is no longer allowed. */
  it("goes inert when the caller re-skips after the notice fired", async () => {
    const { result, rerender } = renderGate()
    await flushCheck()
    await advance(DELAYED_NOTICE_MS)
    expect(result.current.isReceiveDelayed).toBe(true)
    const checksSoFar = mockCheckReceiveLanded.mock.calls.length

    rerender({ skip: true })
    await advance(60_000)

    expect(result.current).toEqual({
      isReceiveConfirmed: false,
      isReceiveProven: false,
      isReceiveDelayed: false,
      recheck: expect.any(Function),
    })
    expect(mockCheckReceiveLanded.mock.calls).toHaveLength(checksSoFar)
  })

  /** Both callers recompute `skip` from inputs that hydrate and flap; a window re-armed
   *  from zero on each flap would never elapse and the notice would never appear. */
  it("reaches the notice across a caller whose skip flaps", async () => {
    const { result, rerender } = renderGate()
    await flushCheck()

    await advance(DELAYED_NOTICE_MS / 2)
    expect(result.current.isReceiveDelayed).toBe(false)

    rerender({ skip: true })
    rerender({ skip: false })
    await flushCheck()

    await advance(DELAYED_NOTICE_MS / 2)
    expect(result.current.isReceiveDelayed).toBe(true)
  })

  /** The gate never gives up, so past the notice window the checks back off rather than
   *  opening an SDK connection every 5s for the rest of the session. */
  it("backs the checks off once the wait passes the notice window", async () => {
    const { result } = renderGate()
    await flushCheck()

    await advance(DELAYED_NOTICE_MS)
    expect(result.current.isReceiveDelayed).toBe(true)
    const checksAtNotice = mockCheckReceiveLanded.mock.calls.length

    await advance(RECEIVE_CHECK_RETRY_MS)
    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(checksAtNotice)

    await advance(DELAYED_RETRY_MS - RECEIVE_CHECK_RETRY_MS)
    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(checksAtNotice + 1)
  })

  /** The wait belongs to one migration's receive: a gate re-pointed at another wallet must
   *  not inherit a notice minted for a payment it never waited on. */
  it("measures a fresh window when the gate is pointed at another wallet", async () => {
    const { result, rerender } = renderGate()
    await flushCheck()
    await advance(DELAYED_NOTICE_MS)
    expect(result.current.isReceiveDelayed).toBe(true)

    rerender({ selfCustodialAccountId: "sc-account-2" })
    await flushCheck()
    expect(result.current.isReceiveDelayed).toBe(false)

    await advance(DELAYED_NOTICE_MS)
    expect(result.current.isReceiveDelayed).toBe(true)
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

  /**
   * The swap this would release checks the account index, not the keystore, so it would
   * discard the working custodial session for a wallet whose key is unrecoverable and
   * leave the user with neither. Not confirming keeps the working session, and the
   * delayed notice is what routes the user to support.
   */
  it("does not confirm when the wallet's key is gone from the device", async () => {
    mockCheckReceiveLanded.mockResolvedValue({ status: MigrationSdkStatus.NoMnemonic })

    const { result } = renderGate()
    await flushCheck()

    expect(result.current.isReceiveConfirmed).toBe(false)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration receive check",
      expect.objectContaining({ message: "No mnemonic for the provisioned account" }),
    )
  })

  it("keeps checking after a missing mnemonic, in case the keystore reads again", async () => {
    mockCheckReceiveLanded
      .mockResolvedValueOnce({ status: MigrationSdkStatus.NoMnemonic })
      .mockResolvedValue(ok(landed))

    const { result } = renderGate()
    await flushCheck()
    expect(result.current.isReceiveConfirmed).toBe(false)

    await advance(RECEIVE_CHECK_RETRY_MS)
    expect(result.current.isReceiveConfirmed).toBe(true)
  })

  it("reports a missing mnemonic once, however many checks find it", async () => {
    mockCheckReceiveLanded.mockResolvedValue({ status: MigrationSdkStatus.NoMnemonic })

    renderGate()
    await flushCheck()
    await advance(RECEIVE_CHECK_RETRY_MS)
    await advance(RECEIVE_CHECK_RETRY_MS)

    expect(mockReportError).toHaveBeenCalledTimes(1)
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
    expect(result.current.isReceiveConfirmed).toBe(false)

    const checksSoFar = mockCheckReceiveLanded.mock.calls.length
    await advance(DELAYED_RETRY_MS)
    expect(mockCheckReceiveLanded.mock.calls.length).toBeGreaterThan(checksSoFar)
  })

  /** The escape hatch, off by default: with the flag on, the elapsed window opens the
   *  gate — no notice, straight to the swap, as the flow behaved before the gate. */
  it("releases the redirect after the window when the delayed-redirect flag is on", async () => {
    mockRemoteConfig.migrationDelayedRedirectEnabled = true

    const { result } = renderGate()
    await flushCheck()
    expect(result.current.isReceiveConfirmed).toBe(false)

    await advance(DELAYED_NOTICE_MS)

    expect(result.current.isReceiveConfirmed).toBe(true)
    expect(result.current.isReceiveDelayed).toBe(false)
  })

  /** The release moves the user, never the custodial account: nothing was ever seen to
   *  land, so the deletion that reads this stays put (#4102). */
  it("does not call the release proven", async () => {
    mockRemoteConfig.migrationDelayedRedirectEnabled = true

    const { result } = renderGate()
    await flushCheck()
    await advance(DELAYED_NOTICE_MS)

    expect(result.current.isReceiveConfirmed).toBe(true)
    expect(result.current.isReceiveProven).toBe(false)
  })

  it("proves the receive when a check actually finds the funds", async () => {
    mockCheckReceiveLanded.mockResolvedValue(ok(landed))

    const { result } = renderGate()
    await flushCheck()

    expect(result.current.isReceiveProven).toBe(true)
  })

  /** Nothing was ever going to arrive, so an empty wallet is the confirmed outcome rather
   *  than an unknown one: the close may run. */
  it("proves a zero-receive migration without the SDK", async () => {
    const { result } = renderGate({ expectedReceiveSats: 0 })
    await flushCheck()

    expect(result.current.isReceiveProven).toBe(true)
    expect(mockCheckReceiveLanded).not.toHaveBeenCalled()
  })

  it("proves nothing while the gate is skipped", async () => {
    const { result } = renderGate({ skip: true })
    await flushCheck()

    expect(result.current.isReceiveProven).toBe(false)
  })

  it("stops checking once the timeout releases the gate", async () => {
    mockRemoteConfig.migrationDelayedRedirectEnabled = true

    renderGate()
    await flushCheck()
    await advance(DELAYED_NOTICE_MS)
    const checksSoFar = mockCheckReceiveLanded.mock.calls.length

    await advance(60_000)

    expect(mockCheckReceiveLanded.mock.calls).toHaveLength(checksSoFar)
  })

  it("still confirms through a landed receive before the window with the flag on", async () => {
    mockRemoteConfig.migrationDelayedRedirectEnabled = true
    mockCheckReceiveLanded.mockResolvedValue(ok(landed))

    const { result } = renderGate()
    await flushCheck()

    expect(result.current.isReceiveConfirmed).toBe(true)
    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
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

  /** A check in flight at unmount settles into a torn-down hook: its result must be
   *  dropped, not turned into a state update or another scheduled check. */
  it("drops a check that settles after unmount", async () => {
    let settle: (value: unknown) => void = () => {}
    mockCheckReceiveLanded.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )

    const { unmount } = renderGate()
    await flushCheck()
    unmount()

    settle(ok(stillEmpty))
    await advance(60_000)

    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
  })

  it("drops a check that rejects after unmount, without reporting", async () => {
    let fail: (err: unknown) => void = () => {}
    mockCheckReceiveLanded.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject
      }),
    )

    const { unmount } = renderGate()
    await flushCheck()
    unmount()

    fail(new Error("keystore locked"))
    await advance(60_000)

    expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
    expect(mockReportError).not.toHaveBeenCalled()
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

  /** The caller hands support over only on a look taken since the app came back, so it
   *  is told each time a check reaches the wallet, and when that look began. A check that
   *  never reached it says nothing about the funds and must not count as one. */
  describe("each check that reaches the wallet", () => {
    it("reports when a look that found nothing began", async () => {
      jest.setSystemTime(1_000_000)
      const onWalletChecked = jest.fn()

      renderGate({ onWalletChecked })
      await flushCheck()
      expect(onWalletChecked).toHaveBeenLastCalledWith(1_000_000)

      await advance(RECEIVE_CHECK_RETRY_MS)
      expect(onWalletChecked).toHaveBeenCalledTimes(2)
      expect(onWalletChecked).toHaveBeenLastCalledWith(1_000_000 + RECEIVE_CHECK_RETRY_MS)
    })

    /** Funds that landed confirm the gate, which withdraws the notice itself; the report
     *  still goes out so the caller's record of the latest look stays true. */
    it("reports the look that confirms the receive too", async () => {
      const onWalletChecked = jest.fn()
      mockCheckReceiveLanded.mockResolvedValue(ok(landed))

      renderGate({ onWalletChecked })
      await flushCheck()

      expect(onWalletChecked).toHaveBeenCalledTimes(1)
    })

    /** A missing key is an answer that no retry will change, and support is where it has
     *  to end: not counting it would leave that user on "on its way" for good. */
    it("reports a wallet whose key is gone", async () => {
      const onWalletChecked = jest.fn()
      mockCheckReceiveLanded.mockResolvedValue({ status: MigrationSdkStatus.NoMnemonic })

      renderGate({ onWalletChecked })
      await flushCheck()

      expect(onWalletChecked).toHaveBeenCalledTimes(1)
    })

    const UNSEEN_WALLET_CASES: { label: string; status: MigrationSdkStatus }[] = [
      { label: "a dropped connection", status: MigrationSdkStatus.ConnectionError },
      { label: "a settled failure", status: MigrationSdkStatus.Failed },
    ]

    it.each(UNSEEN_WALLET_CASES)(
      "does not report $label, which never saw the wallet",
      async ({ status }) => {
        const onWalletChecked = jest.fn()
        mockCheckReceiveLanded.mockResolvedValue({ status, error: new Error("offline") })

        renderGate({ onWalletChecked })
        await flushCheck()

        expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
        expect(onWalletChecked).not.toHaveBeenCalled()
      },
    )

    it("does not report a keystore read that threw", async () => {
      const onWalletChecked = jest.fn()
      mockCheckReceiveLanded.mockRejectedValue(new Error("keystore locked"))

      renderGate({ onWalletChecked })
      await flushCheck()

      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
      expect(onWalletChecked).not.toHaveBeenCalled()
    })

    /** A failed look still frees the slot: a recheck asked for behind it must run. */
    it("runs a queued recheck after a look that failed", async () => {
      let settleCheck: (value: unknown) => void = () => undefined
      mockCheckReceiveLanded.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settleCheck = resolve
          }),
      )
      const { result } = renderGate()
      await flushCheck()

      await act(async () => {
        result.current.recheck()
        await Promise.resolve()
      })
      await act(async () => {
        settleCheck({ status: MigrationSdkStatus.ConnectionError, error: new Error("x") })
        await Promise.resolve()
      })

      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(2)
    })

    it("does not re-arm the polling when the caller passes a fresh callback", async () => {
      const { rerender } = renderGate({ onWalletChecked: jest.fn() })
      await flushCheck()
      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)

      rerender({ onWalletChecked: jest.fn() })
      await flushCheck()

      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)
    })
  })

  /** Once the wait is overdue the next scheduled look can be half a minute out, so the
   *  caller asks for one on the spot when the app comes back. */
  describe("recheck", () => {
    it("looks at once instead of waiting for the next scheduled check", async () => {
      const { result } = renderGate()
      await flushCheck()
      await advance(DELAYED_NOTICE_MS)
      const checksSoFar = mockCheckReceiveLanded.mock.calls.length

      await act(async () => {
        result.current.recheck()
        await Promise.resolve()
      })
      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(checksSoFar + 1)

      /** The scheduled check it replaced does not also fire on its old deadline. */
      await advance(DELAYED_RETRY_MS - 1)
      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(checksSoFar + 1)
      await advance(1)
      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(checksSoFar + 2)
    })

    /** A check in flight began before whatever the caller knows changed: the fresh look
     *  follows it rather than stacking a second connection beside it. */
    it("queues behind a check already in flight", async () => {
      let settleCheck: (value: ReturnType<typeof ok>) => void = () => undefined
      mockCheckReceiveLanded.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settleCheck = resolve
          }),
      )
      const { result } = renderGate()
      await flushCheck()
      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)

      await act(async () => {
        result.current.recheck()
        await Promise.resolve()
      })
      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(1)

      await act(async () => {
        settleCheck(ok(stillEmpty))
        await Promise.resolve()
      })
      expect(mockCheckReceiveLanded).toHaveBeenCalledTimes(2)
    })

    it("does nothing while the gate is skipped", async () => {
      const { result } = renderGate({ skip: true })
      await flushCheck()

      await act(async () => {
        result.current.recheck()
        await Promise.resolve()
      })

      expect(mockCheckReceiveLanded).not.toHaveBeenCalled()
    })
  })
})
