import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act } from "@testing-library/react-native"

import { AccountStatus, AccountType, ActiveWalletStatus } from "@app/types/wallet"

import {
  RecoveryBundleExportError,
  RecoveryBundleExportErrorReason,
} from "@app/self-custodial/recovery-bundle/exporter"
import { useRecoveryBundleRefresh } from "@app/self-custodial/hooks/use-recovery-bundle-refresh"
import type { RefreshBundleResult } from "@app/self-custodial/recovery-bundle/refresh"

const PAYMENT_DEBOUNCE_MS = 15_000
const STARTUP_DELAY_MS = 15_000
const STALE_AFTER_MS = 24 * 60 * 60 * 1000
const RETRY_BASE_DELAY_MS = 60_000
const RETRY_MAX_DELAY_MS = 30 * 60_000

const ACCOUNT_A_ID = "self-custodial-account-a"
const ACCOUNT_B_ID = "self-custodial-account-b"
const MNEMONIC = "test mnemonic words"

const mockRefreshRecoveryBundle = jest.fn()
const mockSyncExistingBundleToCloud = jest.fn()
const mockMarkRecoveryBundleStale = jest.fn()
const mockReadRecoveryBundleState = jest.fn()
const mockGetMnemonicForAccount = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()
const mockUseBackupState = jest.fn()
const mockCrashlyticsLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: mockCrashlyticsLog,
  recordError: mockRecordError,
}))

let mockNetwork = mockSparkNetwork.Regtest
jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork,
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

// Keep the real isCloudSeedBackupCompleted so the gate the hook applies to
// backupState is the production one, not a test re-implementation.
jest.mock("@app/self-custodial/providers/backup-state", () => {
  const actual = jest.requireActual("@app/self-custodial/providers/backup-state")
  return {
    isCloudSeedBackupCompleted: actual.isCloudSeedBackupCompleted,
    useBackupState: () => mockUseBackupState(),
  }
})

// Keep the real isBundleFresh so the staleness policy under test is the
// production one; mock only the side-effecting collaborators.
jest.mock("@app/self-custodial/recovery-bundle/refresh", () => {
  const actual = jest.requireActual("@app/self-custodial/recovery-bundle/refresh")
  return {
    isBundleFresh: actual.isBundleFresh,
    refreshRecoveryBundle: (...args: unknown[]) => mockRefreshRecoveryBundle(...args),
    syncExistingBundleToCloud: (...args: unknown[]) =>
      mockSyncExistingBundleToCloud(...args),
    markRecoveryBundleStale: (...args: unknown[]) => mockMarkRecoveryBundleStale(...args),
  }
})

jest.mock("@app/self-custodial/recovery-bundle/storage", () => ({
  readRecoveryBundleState: (...args: unknown[]) => mockReadRecoveryBundleState(...args),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonicForAccount: (...args: unknown[]) => mockGetMnemonicForAccount(...args),
  },
}))

const selfCustodialAccount = (id: string) => ({
  id,
  type: AccountType.SelfCustodial,
  label: "Spark",
  selected: true,
  status: AccountStatus.Available,
})

const bundleState = (overrides: Partial<Record<string, unknown>> = {}) => ({
  savedAt: Date.now() - 1000,
  bundleCreatedAt: new Date().toISOString(),
  leafCount: 3,
  totalSats: "1000",
  cloudSyncedAt: null,
  ...overrides,
})

const setActiveAccount = (id: string | null) => {
  mockUseAccountRegistry.mockReturnValue({
    activeAccount: id ? selfCustodialAccount(id) : null,
  })
}

const setWallet = (status: ActiveWalletStatus, lastPaymentEventKey: string | null) => {
  mockUseSelfCustodialWallet.mockReturnValue({ status, lastPaymentEventKey })
}

/** Flush pending microtasks (promise .then chains) without moving the clock. */
const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

/** Advance fake timers and let any fired async callbacks settle. */
const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
    await Promise.resolve()
  })
}

/** A refresh result the test settles by hand, to land it mid-flow. */
const deferredRefresh = () => {
  let resolve: (result: RefreshBundleResult) => void = () => {}
  const promise = new Promise<RefreshBundleResult>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

const settleRefresh = async (
  run: ReturnType<typeof deferredRefresh>,
  result: RefreshBundleResult,
) => {
  await act(async () => {
    run.resolve(result)
  })
  await flushMicrotasks()
}

const failedRefresh = (): RefreshBundleResult => ({
  success: false,
  error: new Error("operators unreachable"),
})

describe("useRecoveryBundleRefresh", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockNetwork = mockSparkNetwork.Regtest
    setActiveAccount(ACCOUNT_A_ID)
    setWallet(ActiveWalletStatus.Ready, null)
    mockUseBackupState.mockReturnValue({
      backupState: { status: "none", method: null },
    })
    mockGetMnemonicForAccount.mockResolvedValue(MNEMONIC)
    mockRefreshRecoveryBundle.mockResolvedValue({
      success: true,
      state: bundleState(),
    })
    mockSyncExistingBundleToCloud.mockResolvedValue(true)
    mockMarkRecoveryBundleStale.mockResolvedValue(undefined)
    // Fresh by default so the startup/staleness path stays quiet unless a
    // test opts into it.
    mockReadRecoveryBundleState.mockResolvedValue(bundleState())
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("payment-driven refresh", () => {
    it("schedules exactly one refresh 15s after a new payment id, not before", async () => {
      setWallet(ActiveWalletStatus.Ready, "payment-1")

      renderHook(() => useRecoveryBundleRefresh())

      await advance(PAYMENT_DEBOUNCE_MS - 1)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()

      await advance(1)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledWith({
        accountId: ACCOUNT_A_ID,
        network: mockSparkNetwork.Regtest,
        mnemonic: MNEMONIC,
        appVersion: "1.0.0",
        // Names the payment this run owes coverage for, so a payment landing
        // mid-run is not handed the run that fetched before it settled.
        coverageKey: "payment-1",
      })
    })

    it("marks the bundle as not covering the wallet as soon as a payment arrives, before the debounce", async () => {
      setWallet(ActiveWalletStatus.Ready, "payment-1")

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      expect(mockMarkRecoveryBundleStale).toHaveBeenCalledWith(
        ACCOUNT_A_ID,
        mockSparkNetwork.Regtest,
      )
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()
    })

    it("logs a stale mark that fails and still schedules the refresh", async () => {
      mockMarkRecoveryBundleStale.mockRejectedValue(new Error("storage unavailable"))
      setWallet(ActiveWalletStatus.Ready, "payment-1")

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()
      await advance(PAYMENT_DEBOUNCE_MS)

      expect(mockCrashlyticsLog).toHaveBeenCalledWith(
        expect.stringContaining("stale mark failed"),
      )
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
    })

    it("does not schedule a second refresh after the same payment id was handled", async () => {
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())

      await advance(PAYMENT_DEBOUNCE_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)

      // The first debounce already fired, so a reconnect that re-emits the
      // same last payment id must not refresh it a second time.
      setWallet(ActiveWalletStatus.Loading, "payment-1")
      rerender(undefined)
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      rerender(undefined)

      await flushMicrotasks()
      await advance(PAYMENT_DEBOUNCE_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
    })

    it("schedules a second refresh when a pending payment settles (same id, new tag)", async () => {
      // PaymentPending and PaymentSucceeded carry the same payment id; the
      // event key includes the tag, so settlement reschedules and the bundle
      // snapshots post-settlement leaf state instead of waiting 24h.
      setWallet(ActiveWalletStatus.Ready, "PaymentPending:payment-1")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())

      await advance(PAYMENT_DEBOUNCE_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)

      setWallet(ActiveWalletStatus.Ready, "PaymentSucceeded:payment-1")
      rerender(undefined)

      await advance(PAYMENT_DEBOUNCE_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(2)
    })

    it("does not fire a pending refresh after unmount", async () => {
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      const { unmount } = renderHook(() => useRecoveryBundleRefresh())

      await advance(PAYMENT_DEBOUNCE_MS - 1)
      unmount()

      await advance(PAYMENT_DEBOUNCE_MS + STARTUP_DELAY_MS)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()
    })

    it("clears the pending timer on a network switch and runs the new network's staleness check", async () => {
      // No saved bundle: the startup-staleness path arms a 5s timer whose
      // closure captures the old network. A network-only change must drop it
      // and let the new network's own staleness check schedule a fresh one.
      setWallet(ActiveWalletStatus.Ready, null)
      mockReadRecoveryBundleState.mockResolvedValue(null)
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      await advance(STARTUP_DELAY_MS - 2_000)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()

      mockNetwork = mockSparkNetwork.Mainnet
      rerender(undefined)
      await flushMicrotasks()

      // The old network's deadline passes without firing: its timer was
      // cleared, not left to run with the stale closure.
      await advance(2_000)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()

      await advance(STARTUP_DELAY_MS - 2_000)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
      expect(mockRefreshRecoveryBundle.mock.calls[0][0]).toMatchObject({
        network: mockSparkNetwork.Mainnet,
      })
    })

    it("debounces a burst of payment ids into a single refresh", async () => {
      setWallet(ActiveWalletStatus.Ready, "payment-a")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())

      await advance(10_000)
      setWallet(ActiveWalletStatus.Ready, "payment-b")
      rerender(undefined)

      // Payment A's original deadline (15s after A) passes without a run:
      // the timer was rescheduled, not duplicated.
      await advance(PAYMENT_DEBOUNCE_MS - 1)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()

      await advance(1)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)

      await advance(PAYMENT_DEBOUNCE_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
    })

    it("retries the same payment event after readiness cancels its pending debounce", async () => {
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())

      // The 15s debounce timer is pending but has not fired yet.
      await advance(PAYMENT_DEBOUNCE_MS - 5_000)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()

      // Wallet leaves Ready before the deadline: the pending timer must be
      // cleared, and nothing may be scheduled while not ready.
      setWallet(ActiveWalletStatus.Loading, "payment-1")
      rerender(undefined)
      await flushMicrotasks()

      await advance(PAYMENT_DEBOUNCE_MS + STARTUP_DELAY_MS)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()
      // The startup-staleness path is gated on walletReady too: the not-ready
      // render must not even read the saved bundle state to schedule from it.
      expect(mockReadRecoveryBundleState).not.toHaveBeenCalled()

      // Returning to Ready with the same latest event must schedule a fresh
      // debounce because the previous one never reached its run decision.
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      rerender(undefined)

      await advance(PAYMENT_DEBOUNCE_MS - 1)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()

      await advance(1)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
    })
  })

  describe("startup staleness refresh", () => {
    it("schedules a refresh 5s after startup when no bundle state is saved", async () => {
      setWallet(ActiveWalletStatus.Ready, null)
      mockReadRecoveryBundleState.mockResolvedValue(null)

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      await advance(STARTUP_DELAY_MS - 1)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()

      await advance(1)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
      expect(mockReadRecoveryBundleState).toHaveBeenCalledWith(
        ACCOUNT_A_ID,
        mockSparkNetwork.Regtest,
      )
    })

    it("schedules a refresh when the saved bundle is older than 24h", async () => {
      setWallet(ActiveWalletStatus.Ready, null)
      mockReadRecoveryBundleState.mockResolvedValue(
        bundleState({ savedAt: Date.now() - STALE_AFTER_MS - 1 }),
      )

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      await advance(STARTUP_DELAY_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
    })

    it("does not schedule a refresh when the saved bundle is fresher than 24h", async () => {
      setWallet(ActiveWalletStatus.Ready, null)
      mockReadRecoveryBundleState.mockResolvedValue(
        bundleState({ savedAt: Date.now() - STALE_AFTER_MS + 60_000 }),
      )

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      await advance(STALE_AFTER_MS)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()
    })
  })

  describe("account switch", () => {
    it("clears account A's pending timer and resets payment dedupe when switching to account B", async () => {
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())

      // A's refresh is pending, 5s away from firing.
      await advance(10_000)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()

      // Switch account; the same payment id is still the wallet's last one.
      setActiveAccount(ACCOUNT_B_ID)
      rerender(undefined)

      // A's original deadline passes: its timer must have been cleared.
      await advance(5_000)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()

      // The dedupe ref was reset, so the id A already handled schedules a
      // fresh debounce for B, which fires 15s after the switch.
      await advance(10_000)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
      expect(mockRefreshRecoveryBundle.mock.calls[0][0]).toMatchObject({
        accountId: ACCOUNT_B_ID,
      })
      expect(mockGetMnemonicForAccount).toHaveBeenCalledWith(ACCOUNT_B_ID)
      expect(mockGetMnemonicForAccount).not.toHaveBeenCalledWith(ACCOUNT_A_ID)
    })
  })

  describe("nothing to refresh", () => {
    it("schedules nothing without a self-custodial account", async () => {
      setActiveAccount(null)
      setWallet(ActiveWalletStatus.Ready, "payment-1")

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()
      await advance(PAYMENT_DEBOUNCE_MS + STARTUP_DELAY_MS)

      expect(mockReadRecoveryBundleState).not.toHaveBeenCalled()
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()
    })

    it("settles a payment refresh without retrying when the account has no mnemonic", async () => {
      mockGetMnemonicForAccount.mockResolvedValue(null)
      setWallet(ActiveWalletStatus.Ready, "payment-1")

      renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS)
      await flushMicrotasks()
      await advance(RETRY_MAX_DELAY_MS)

      expect(mockGetMnemonicForAccount).toHaveBeenCalledTimes(1)
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()
    })

    it("drops a staleness read that settles after the account changed", async () => {
      let resolveState: (state: null) => void = () => {}
      mockReadRecoveryBundleState.mockReturnValueOnce(
        new Promise<null>((resolve) => {
          resolveState = resolve
        }),
      )
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())

      setActiveAccount(null)
      rerender(undefined)
      await act(async () => {
        resolveState(null)
      })
      await advance(STARTUP_DELAY_MS)

      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()
    })

    it("logs a staleness read that fails instead of scheduling from it", async () => {
      mockReadRecoveryBundleState.mockRejectedValue(new Error("storage unavailable"))

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()
      await advance(STARTUP_DELAY_MS)

      expect(mockCrashlyticsLog).toHaveBeenCalledWith(
        expect.stringContaining("state read failed"),
      )
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()
    })
  })

  describe("failure reporting", () => {
    it("wraps a non-Error refresh failure before recording it", async () => {
      mockRefreshRecoveryBundle.mockResolvedValue({ success: false, error: "timeout" })
      setWallet(ActiveWalletStatus.Ready, "payment-1")

      renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS)
      await flushMicrotasks()

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "timeout" }),
        "recovery-bundle-refresh",
      )
    })

    it("wraps a non-Error thrown before the refresh before recording it", async () => {
      mockGetMnemonicForAccount.mockRejectedValueOnce("keychain unreadable")
      setWallet(ActiveWalletStatus.Ready, "payment-1")

      renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS)
      await flushMicrotasks()

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "keychain unreadable" }),
        "recovery-bundle-refresh",
      )
    })

    it("records non-benign refresh failures with crashlytics", async () => {
      const failure = new Error("operators unreachable")
      mockRefreshRecoveryBundle.mockResolvedValue({ success: false, error: failure })
      setWallet(ActiveWalletStatus.Ready, "payment-1")

      renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS)

      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
      expect(mockRecordError).toHaveBeenCalledWith(failure, "recovery-bundle-refresh")
    })

    it("does not record a NoLeaves export error (benign empty wallet)", async () => {
      mockRefreshRecoveryBundle.mockResolvedValue({
        success: false,
        error: new RecoveryBundleExportError(
          RecoveryBundleExportErrorReason.NoLeaves,
          "wallet has no leaves",
        ),
      })
      setWallet(ActiveWalletStatus.Ready, "payment-1")

      renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS)

      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
      expect(mockRecordError).not.toHaveBeenCalled()
    })
  })

  describe("failed refresh retry", () => {
    it("retries a failed payment refresh after a minute although the saved bundle still reads fresh", async () => {
      mockRefreshRecoveryBundle.mockResolvedValueOnce(failedRefresh())
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      renderHook(() => useRecoveryBundleRefresh())

      await advance(PAYMENT_DEBOUNCE_MS)
      await flushMicrotasks()
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)

      await advance(RETRY_BASE_DELAY_MS - 1)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)

      await advance(1)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(2)
      expect(mockRefreshRecoveryBundle.mock.calls[1][0]).toMatchObject({
        coverageKey: "payment-1",
      })

      await flushMicrotasks()
      await advance(RETRY_MAX_DELAY_MS * 2)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(2)
    })

    it("doubles the retry delay per failure up to a 30 minute cap, then stops after six retries", async () => {
      mockRefreshRecoveryBundle.mockResolvedValue(failedRefresh())
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS)

      const expectedDelays = [
        RETRY_BASE_DELAY_MS,
        RETRY_BASE_DELAY_MS * 2,
        RETRY_BASE_DELAY_MS * 4,
        RETRY_BASE_DELAY_MS * 8,
        RETRY_BASE_DELAY_MS * 16,
        RETRY_MAX_DELAY_MS,
      ]
      for (const [index, delay] of expectedDelays.entries()) {
        await flushMicrotasks()
        await advance(delay - 1)
        expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(index + 1)
        await advance(1)
        expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(index + 2)
      }

      await flushMicrotasks()
      await advance(RETRY_MAX_DELAY_MS * 4)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(expectedDelays.length + 1)
    })

    it("retries a refresh whose mnemonic read throws before reaching the operators", async () => {
      mockGetMnemonicForAccount.mockRejectedValueOnce(new Error("keychain unavailable"))
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      renderHook(() => useRecoveryBundleRefresh())

      await advance(PAYMENT_DEBOUNCE_MS)
      await flushMicrotasks()
      expect(mockRefreshRecoveryBundle).not.toHaveBeenCalled()
      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "keychain unavailable" }),
        "recovery-bundle-refresh",
      )

      await advance(RETRY_BASE_DELAY_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
    })

    it("retries a failed startup refresh, which covers no payment", async () => {
      mockReadRecoveryBundleState.mockResolvedValue(null)
      mockRefreshRecoveryBundle.mockResolvedValueOnce(failedRefresh())
      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      await advance(STARTUP_DELAY_MS)
      await flushMicrotasks()
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)

      await advance(RETRY_BASE_DELAY_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(2)
      expect(mockRefreshRecoveryBundle.mock.calls[1][0].coverageKey).toBeUndefined()
    })

    it("leaves a failed refresh to the newer payment that replaced it mid-run", async () => {
      const firstRun = deferredRefresh()
      mockRefreshRecoveryBundle.mockReturnValueOnce(firstRun.promise)
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS)
      await flushMicrotasks()
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)

      setWallet(ActiveWalletStatus.Ready, "payment-2")
      rerender(undefined)
      await settleRefresh(firstRun, failedRefresh())

      await advance(PAYMENT_DEBOUNCE_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(2)
      expect(mockRefreshRecoveryBundle.mock.calls[1][0]).toMatchObject({
        coverageKey: "payment-2",
      })

      await flushMicrotasks()
      await advance(RETRY_BASE_DELAY_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(2)
    })

    it("leaves a refresh that failed after the wallet left Ready to the next Ready render's staleness check", async () => {
      const run = deferredRefresh()
      mockRefreshRecoveryBundle.mockReturnValueOnce(run.promise)
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS)
      await flushMicrotasks()

      setWallet(ActiveWalletStatus.Loading, "payment-1")
      rerender(undefined)
      await settleRefresh(run, failedRefresh())
      await advance(RETRY_BASE_DELAY_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)

      // The mark set when the payment arrived outlives the failed run.
      mockReadRecoveryBundleState.mockResolvedValue(
        bundleState({ uncoveredChangeAt: Date.now() - PAYMENT_DEBOUNCE_MS }),
      )
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      rerender(undefined)
      await flushMicrotasks()
      await advance(STARTUP_DELAY_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(2)
    })

    it("keeps a scheduled refresh when the wallet's last payment key clears before it fires", async () => {
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS - 5_000)

      setWallet(ActiveWalletStatus.Ready, null)
      rerender(undefined)
      await flushMicrotasks()

      await advance(5_000)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
      expect(mockReadRecoveryBundleState).not.toHaveBeenCalled()
    })

    it("keeps an event covered when its refresh succeeds after the wallet left Ready", async () => {
      const run = deferredRefresh()
      mockRefreshRecoveryBundle.mockReturnValueOnce(run.promise)
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())
      await advance(PAYMENT_DEBOUNCE_MS)
      await flushMicrotasks()

      setWallet(ActiveWalletStatus.Loading, "payment-1")
      rerender(undefined)
      await settleRefresh(run, { success: true, state: bundleState() })

      setWallet(ActiveWalletStatus.Ready, "payment-1")
      rerender(undefined)
      await flushMicrotasks()
      await advance(PAYMENT_DEBOUNCE_MS + RETRY_BASE_DELAY_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
    })
  })

  describe("cloud sync of an existing bundle", () => {
    /** With or without a passphrase on the seed: the cloud backup alone puts
     *  the bundle in the cloud. */
    it("syncs a never-uploaded bundle when a cloud seed backup exists", async () => {
      mockUseBackupState.mockReturnValue({
        backupState: { status: "completed", method: "cloud" },
      })
      mockReadRecoveryBundleState.mockResolvedValue(bundleState({ cloudSyncedAt: null }))

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      expect(mockSyncExistingBundleToCloud).toHaveBeenCalledTimes(1)
      expect(mockSyncExistingBundleToCloud).toHaveBeenCalledWith(
        ACCOUNT_A_ID,
        mockSparkNetwork.Regtest,
      )
    })

    it("logs a cloud sync that fails instead of throwing from the effect", async () => {
      mockUseBackupState.mockReturnValue({
        backupState: { status: "completed", method: "cloud" },
      })
      mockReadRecoveryBundleState.mockResolvedValue(bundleState({ cloudSyncedAt: null }))
      mockSyncExistingBundleToCloud.mockRejectedValue(new Error("drive unreachable"))

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()
      await flushMicrotasks()

      expect(mockCrashlyticsLog).toHaveBeenCalledWith(
        expect.stringContaining("cloud sync failed"),
      )
    })

    it("does not sync when the bundle on disk is the one already uploaded", async () => {
      mockUseBackupState.mockReturnValue({
        backupState: { status: "completed", method: "cloud" },
      })
      mockReadRecoveryBundleState.mockResolvedValue(
        bundleState({
          bundleCreatedAt: "2026-10-27T12:00:00.000Z",
          cloudSyncedAt: Date.now() - 60_000,
          cloudSyncedBundleCreatedAt: "2026-10-27T12:00:00.000Z",
        }),
      )

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
    })

    it("syncs when the cloud holds an older bundle than the one on disk", async () => {
      mockUseBackupState.mockReturnValue({
        backupState: { status: "completed", method: "cloud" },
      })
      mockReadRecoveryBundleState.mockResolvedValue(
        bundleState({
          bundleCreatedAt: "2026-10-27T12:00:00.000Z",
          cloudSyncedAt: Date.now() - 60_000,
          cloudSyncedBundleCreatedAt: "2026-10-26T09:00:00.000Z",
        }),
      )

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      expect(mockSyncExistingBundleToCloud).toHaveBeenCalledTimes(1)
    })

    it("does not sync when cloud seed backup is not completed", async () => {
      mockReadRecoveryBundleState.mockResolvedValue(bundleState({ cloudSyncedAt: null }))

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
    })

    it("syncs as soon as a cloud seed backup completes", async () => {
      mockReadRecoveryBundleState.mockResolvedValue(bundleState({ cloudSyncedAt: null }))

      const { rerender } = renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()
      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()

      mockUseBackupState.mockReturnValue({
        backupState: { status: "completed", method: "cloud" },
      })
      rerender(undefined)
      await flushMicrotasks()

      expect(mockSyncExistingBundleToCloud).toHaveBeenCalledTimes(1)
    })
  })
})
