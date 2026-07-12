import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act } from "@testing-library/react-native"

import { AccountStatus, AccountType, ActiveWalletStatus } from "@app/types/wallet"

import {
  RecoveryBundleExportError,
  RecoveryBundleExportErrorReason,
} from "@app/self-custodial/recovery-bundle/exporter"
import { useRecoveryBundleRefresh } from "@app/self-custodial/hooks/use-recovery-bundle-refresh"

const PAYMENT_DEBOUNCE_MS = 15_000
const STARTUP_DELAY_MS = 5_000
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

const ACCOUNT_A_ID = "self-custodial-account-a"
const ACCOUNT_B_ID = "self-custodial-account-b"
const MNEMONIC = "test mnemonic words"

const mockRefreshRecoveryBundle = jest.fn()
const mockSyncExistingBundleToCloud = jest.fn()
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

const setWallet = (status: ActiveWalletStatus, lastReceivedPaymentId: string | null) => {
  mockUseSelfCustodialWallet.mockReturnValue({ status, lastReceivedPaymentId })
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
      })
    })

    it("does not schedule a second refresh when the same payment id is re-delivered", async () => {
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      const { rerender } = renderHook(() => useRecoveryBundleRefresh())

      await advance(PAYMENT_DEBOUNCE_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)

      // Wallet drops out of Ready and comes back with the same last payment
      // id (e.g. a reconnect re-emits state) - the effect re-runs, but the
      // dedupe ref must block a second schedule.
      setWallet(ActiveWalletStatus.Loading, "payment-1")
      rerender(undefined)
      setWallet(ActiveWalletStatus.Ready, "payment-1")
      rerender(undefined)

      await flushMicrotasks()
      await advance(PAYMENT_DEBOUNCE_MS)
      expect(mockRefreshRecoveryBundle).toHaveBeenCalledTimes(1)
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

  describe("failure reporting", () => {
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

  describe("cloud sync of an existing bundle", () => {
    it("syncs a never-uploaded bundle when cloud seed backup is completed", async () => {
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

    it("does not sync when the bundle was already uploaded", async () => {
      mockUseBackupState.mockReturnValue({
        backupState: { status: "completed", method: "cloud" },
      })
      mockReadRecoveryBundleState.mockResolvedValue(
        bundleState({ cloudSyncedAt: Date.now() - 60_000 }),
      )

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
    })

    it("does not sync when cloud seed backup is not completed", async () => {
      mockReadRecoveryBundleState.mockResolvedValue(bundleState({ cloudSyncedAt: null }))

      renderHook(() => useRecoveryBundleRefresh())
      await flushMicrotasks()

      expect(mockSyncExistingBundleToCloud).not.toHaveBeenCalled()
    })
  })
})
