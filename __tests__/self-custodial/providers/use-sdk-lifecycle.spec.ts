import { renderHook, act, waitFor } from "@testing-library/react-native"

import { ActiveWalletStatus } from "@app/types/wallet"
import { useSdkLifecycle } from "@app/self-custodial/providers/use-sdk-lifecycle"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  // eslint-disable-next-line camelcase
  SdkEvent_Tags: {
    Synced: "Synced",
    PaymentSucceeded: "PaymentSucceeded",
    PaymentPending: "PaymentPending",
    ClaimedDeposits: "ClaimedDeposits",
    UnclaimedDeposits: "UnclaimedDeposits",
    PaymentFailed: "PaymentFailed",
    Optimization: "Optimization",
  },
}))

const mockGetMnemonicForAccount = jest.fn()
jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonicForAccount: (id: string) => mockGetMnemonicForAccount(id),
  },
}))

const mockInitSdk = jest.fn()
const mockDisconnectSdk = jest.fn()
const mockAddSdkEventListener = jest.fn()
const mockRemoveSdkEventListener = jest.fn()
const mockGetUserSettings = jest.fn()
const mockSyncSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  initSdk: (...args: unknown[]) => mockInitSdk(...args),
  disconnectSdk: (...args: unknown[]) => mockDisconnectSdk(...args),
  addSdkEventListener: (...args: unknown[]) => mockAddSdkEventListener(...args),
  removeSdkEventListener: (...args: unknown[]) => mockRemoveSdkEventListener(...args),
  getUserSettings: (...args: unknown[]) => mockGetUserSettings(...args),
  syncSelfCustodialWallet: (...args: unknown[]) => mockSyncSelfCustodialWallet(...args),
}))

const mockValidateStoredNetwork = jest.fn()
jest.mock("@app/self-custodial/providers/validate-network", () => ({
  validateStoredNetwork: (id: string) => mockValidateStoredNetwork(id),
}))

const mockGetSnapshot = jest.fn()
jest.mock("@app/self-custodial/providers/wallet-snapshot", () => ({
  getSelfCustodialWalletSnapshot: (...args: unknown[]) => mockGetSnapshot(...args),
  loadMoreTransactions: jest
    .fn()
    .mockResolvedValue({ transactions: [], hasMore: false, rawCount: 0 }),
  appendTransactions: jest.fn().mockImplementation((wallets: unknown) => wallets),
}))

jest.mock("@app/self-custodial/providers/is-online", () => ({
  OnlineState: { Online: "online", Offline: "offline", Unknown: "unknown" },
  getOnlineState: jest.fn().mockResolvedValue("online"),
  getServiceStatus: jest.fn().mockResolvedValue(0),
  isDegradedStatus: jest.fn().mockReturnValue(false),
  STATUS_TIMEOUT_MS: 5000,
}))

jest.mock("@app/utils/with-timeout", () => ({
  withTimeout: <T>(p: Promise<T>) => p,
}))

jest.mock("@app/self-custodial/logging", () => ({
  logSdkEvent: jest.fn(),
  SdkLogLevel: { Error: "error" },
}))

jest.mock("@app/self-custodial/config", () => ({
  storageDirFor: (id: string) => `/tmp/${id}`,
}))

const mockRecordError = jest.fn()
const mockCrashlyticsLog = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: (...args: unknown[]) => mockCrashlyticsLog(...args),
}))

type SdkEventListener = (event: { tag: string; inner?: unknown }) => Promise<void>

const captureListener = (): { current: SdkEventListener | null } => {
  const ref: { current: SdkEventListener | null } = { current: null }
  mockAddSdkEventListener.mockImplementation(
    (_sdk: unknown, onEvent: SdkEventListener) => {
      ref.current = onEvent
      return Promise.resolve("listener-id")
    },
  )
  return ref
}

const buildSdk = (id: string) => ({ id }) as unknown as object

describe("useSdkLifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMnemonicForAccount.mockResolvedValue("word1 word2 word3")
    mockValidateStoredNetwork.mockResolvedValue(true)
    mockGetSnapshot.mockResolvedValue({
      wallets: [],
      hasMore: false,
      rawTransactionCount: 0,
    })
    mockAddSdkEventListener.mockResolvedValue("listener-id")
    mockRemoveSdkEventListener.mockResolvedValue(undefined)
    mockGetUserSettings.mockResolvedValue({ stableBalanceActiveLabel: undefined })
    mockSyncSelfCustodialWallet.mockResolvedValue(undefined)
    mockDisconnectSdk.mockResolvedValue(undefined)
    const isOnline = jest.requireMock("@app/self-custodial/providers/is-online")
    isOnline.getOnlineState.mockResolvedValue("online")
    isOnline.getServiceStatus.mockResolvedValue(0)
    isOnline.isDegradedStatus.mockReturnValue(false)
  })

  describe("inactive paths", () => {
    it("stays Unavailable and never calls initSdk when accountId is null", async () => {
      const { result } = renderHook(() => useSdkLifecycle(null, 0))

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
      })
      expect(mockInitSdk).not.toHaveBeenCalled()
    })

    it("falls to Unavailable when the keystore has no mnemonic for the account", async () => {
      mockGetMnemonicForAccount.mockResolvedValue(null)

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
      })
      expect(mockInitSdk).not.toHaveBeenCalled()
    })

    it("falls to Error when the stored network does not match the current build (Critical #11)", async () => {
      mockValidateStoredNetwork.mockResolvedValue(false)

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Error)
      })
      expect(mockInitSdk).not.toHaveBeenCalled()
    })

    it("falls to Error when initSdk throws (Critical #11)", async () => {
      mockInitSdk.mockRejectedValue(new Error("connect failed"))

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Error)
      })
    })
  })

  describe("happy path", () => {
    it("loads the mnemonic, validates the network, initializes the SDK, and reaches Ready after the Synced event (Critical #11)", async () => {
      const sdk = buildSdk("sdk-1")
      mockInitSdk.mockResolvedValue(sdk)
      const listener = captureListener()

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(result.current.sdk).toBe(sdk)
      })

      expect(mockGetMnemonicForAccount).toHaveBeenCalledWith("acct-1")
      expect(mockValidateStoredNetwork).toHaveBeenCalledWith("acct-1")
      expect(mockInitSdk).toHaveBeenCalledWith("word1 word2 word3", "/tmp/acct-1")
      expect(result.current.connectedAccountId).toBe("acct-1")

      await waitFor(() => {
        expect(listener.current).not.toBeNull()
      })
      await act(async () => {
        await listener.current?.({ tag: "Synced" })
      })

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Ready)
      })
    })

    it("surfaces the lastReceivedPaymentId when a PaymentSucceeded event fires (Critical #11)", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      const listener = captureListener()

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(listener.current).not.toBeNull()
      })

      await act(async () => {
        await listener.current?.({
          tag: "PaymentSucceeded",
          inner: { payment: { id: "p1" } },
        })
      })

      expect(result.current.lastReceivedPaymentId).toBe("p1")
    })
  })

  describe("post-connect sync rejection (Important #9)", () => {
    it("records the rejection as a non-fatal crashlytics error instead of a buried breadcrumb", async () => {
      const syncError = new Error("network down")
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      mockSyncSelfCustodialWallet.mockRejectedValue(syncError)
      captureListener()

      renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(mockRecordError).toHaveBeenCalledWith(syncError)
      })
      expect(mockCrashlyticsLog).not.toHaveBeenCalledWith(
        expect.stringContaining("post-connect sync failed"),
      )
    })

    it("does not force Ready when sync rejects — wallet waits for the Synced event before flipping status", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      mockSyncSelfCustodialWallet.mockRejectedValue(new Error("post-connect sync failed"))
      const listener = captureListener()
      const snapshotsBefore = mockGetSnapshot.mock.calls.length

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(mockRecordError).toHaveBeenCalled()
      })
      await waitFor(() => {
        expect(listener.current).not.toBeNull()
      })

      // The sync rejection alone must not transition the wallet to Ready.
      expect(result.current.status).not.toBe(ActiveWalletStatus.Ready)

      // A subsequent Synced event is what actually flips status to Ready.
      await act(async () => {
        await listener.current?.({ tag: "Synced" })
      })

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Ready)
      })

      // refreshWallets() from the .finally branch is gone — only the listener-driven
      // snapshots should be triggered after the rejection.
      expect(mockGetSnapshot.mock.calls.length).toBeGreaterThan(snapshotsBefore)
    })
  })

  describe("account-switch disconnect ordering (Critical #11)", () => {
    it("disconnects the previous SDK when the active account changes", async () => {
      const sdkA = buildSdk("sdk-A")
      const sdkB = buildSdk("sdk-B")
      mockInitSdk.mockResolvedValueOnce(sdkA).mockResolvedValueOnce(sdkB)
      captureListener()

      const { rerender } = renderHook(
        ({ accountId }: { accountId: string }) => useSdkLifecycle(accountId, 0),
        { initialProps: { accountId: "acct-A" } },
      )

      await waitFor(() => {
        expect(mockInitSdk).toHaveBeenCalledWith("word1 word2 word3", "/tmp/acct-A")
      })

      rerender({ accountId: "acct-B" })

      await waitFor(() => {
        expect(mockDisconnectSdk).toHaveBeenCalledWith(sdkA)
      })
      await waitFor(() => {
        expect(mockInitSdk).toHaveBeenCalledWith("word1 word2 word3", "/tmp/acct-B")
      })

      expect(mockRemoveSdkEventListener).toHaveBeenCalledWith(sdkA, "listener-id")
    })

    it("disconnects the SDK on unmount (Critical #11)", async () => {
      const sdk = buildSdk("sdk-1")
      mockInitSdk.mockResolvedValue(sdk)
      captureListener()

      const { unmount } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(mockInitSdk).toHaveBeenCalled()
      })

      unmount()

      await waitFor(() => {
        expect(mockDisconnectSdk).toHaveBeenCalledWith(sdk)
      })
    })

    it("flips status to Unavailable when accountId transitions to null after being active (Critical #11)", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      captureListener()

      const { result, rerender } = renderHook(
        ({ accountId }: { accountId: string | null }) => useSdkLifecycle(accountId, 0),
        { initialProps: { accountId: "acct-1" as string | null } },
      )

      await waitFor(() => {
        expect(result.current.sdk).not.toBeNull()
      })

      rerender({ accountId: null })

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
      })
      expect(result.current.sdk).toBeNull()
    })
  })

  describe("listener event filtering (Critical #11)", () => {
    it("ignores events whose tag is not in REFRESH_EVENTS", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      const listener = captureListener()

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(listener.current).not.toBeNull()
      })

      const snapshotCallsBefore = mockGetSnapshot.mock.calls.length

      await act(async () => {
        await listener.current?.({ tag: "Optimization" })
      })

      expect(mockGetSnapshot.mock.calls).toHaveLength(snapshotCallsBefore)
      expect(result.current.lastReceivedPaymentId).toBeNull()
    })

    it("does not update lastReceivedPaymentId when the event lacks inner.payment", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      const listener = captureListener()

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(listener.current).not.toBeNull()
      })

      await act(async () => {
        await listener.current?.({ tag: "PaymentSucceeded", inner: undefined })
      })

      expect(result.current.lastReceivedPaymentId).toBeNull()
    })
  })

  describe("loadMore (Critical #11)", () => {
    it("appends loaded transactions and advances the raw offset", async () => {
      const sdk = buildSdk("sdk-1")
      mockInitSdk.mockResolvedValue(sdk)
      captureListener()

      const newTransactions = [{ id: "tx-1" }]
      const { loadMoreTransactions: loadMoreMock, appendTransactions: appendMock } =
        jest.requireMock("@app/self-custodial/providers/wallet-snapshot")
      loadMoreMock.mockResolvedValue({
        transactions: newTransactions,
        hasMore: true,
        rawCount: 5,
      })
      appendMock.mockImplementation((wallets: unknown[]) => [...wallets, "appended"])

      mockGetSnapshot.mockResolvedValue({
        wallets: ["w1"],
        hasMore: true,
        rawTransactionCount: 0,
      })

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(result.current.hasMoreTransactions).toBe(true)
      })

      await act(async () => {
        await result.current.loadMore()
      })

      expect(loadMoreMock).toHaveBeenCalledWith(sdk, 0)
      expect(appendMock).toHaveBeenCalledWith(["w1"], newTransactions)
      expect(result.current.hasMoreTransactions).toBe(true)
    })

    it("no-ops when hasMoreTransactions is false", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      captureListener()
      const { loadMoreTransactions: loadMoreMock } = jest.requireMock(
        "@app/self-custodial/providers/wallet-snapshot",
      )

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(result.current.sdk).not.toBeNull()
      })

      await act(async () => {
        await result.current.loadMore()
      })

      expect(loadMoreMock).not.toHaveBeenCalled()
    })

    it("no-ops when the SDK is not connected", async () => {
      const { loadMoreTransactions: loadMoreMock } = jest.requireMock(
        "@app/self-custodial/providers/wallet-snapshot",
      )

      const { result } = renderHook(() => useSdkLifecycle(null, 0))

      await act(async () => {
        await result.current.loadMore()
      })

      expect(loadMoreMock).not.toHaveBeenCalled()
    })
  })

  describe("refreshStableBalanceActive (Critical #11)", () => {
    it("reads user settings and flips sdkStableBalanceActive when a label exists", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      captureListener()
      mockGetUserSettings.mockResolvedValueOnce({ stableBalanceActiveLabel: undefined })

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(result.current.sdkStableBalanceActive).toBe(false)
      })

      mockGetUserSettings.mockResolvedValueOnce({ stableBalanceActiveLabel: "USD" })

      await act(async () => {
        await result.current.refreshStableBalanceActive()
      })

      expect(result.current.sdkStableBalanceActive).toBe(true)
    })

    it("no-ops when the SDK is not connected", async () => {
      const { result } = renderHook(() => useSdkLifecycle(null, 0))

      await act(async () => {
        await result.current.refreshStableBalanceActive()
      })

      expect(mockGetUserSettings).not.toHaveBeenCalled()
    })
  })

  describe("refreshWallets re-entrancy (Critical #11)", () => {
    it("coalesces concurrent refresh calls via pendingRefreshRef so runOnce drains the pending flag", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      const listener = captureListener()

      let resolveFirst: (v: {
        wallets: unknown[]
        hasMore: boolean
        rawTransactionCount: number
      }) => void = () => {}
      mockGetSnapshot.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      mockGetSnapshot.mockResolvedValue({
        wallets: [],
        hasMore: false,
        rawTransactionCount: 0,
      })

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(listener.current).not.toBeNull()
      })

      const callsBefore = mockGetSnapshot.mock.calls.length

      act(() => {
        listener.current?.({ tag: "Synced" })
        listener.current?.({ tag: "Synced" })
      })

      await act(async () => {
        resolveFirst({ wallets: [], hasMore: false, rawTransactionCount: 0 })
        await new Promise<void>((r) => {
          setImmediate(r)
        })
      })

      await waitFor(() => {
        expect(mockGetSnapshot.mock.calls.length).toBeGreaterThan(callsBefore)
      })
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })
  })

  describe("offline / degraded transitions (Critical #11)", () => {
    it("flips status to Offline when snapshot fails and connectivity is Offline", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      const listener = captureListener()
      mockGetSnapshot.mockRejectedValue(new Error("snapshot failed"))

      const isOnline = jest.requireMock("@app/self-custodial/providers/is-online")
      isOnline.getOnlineState.mockResolvedValue("offline")

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(listener.current).not.toBeNull()
      })

      await act(async () => {
        await listener.current?.({ tag: "Synced" })
      })

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Offline)
      })
    })

    it("flips status to Error when snapshot fails from Loading with Online connectivity", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      const listener = captureListener()

      const isOnline = jest.requireMock("@app/self-custodial/providers/is-online")
      isOnline.getOnlineState.mockResolvedValue("online")

      mockGetSnapshot.mockRejectedValue(new Error("snapshot failed"))

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(listener.current).not.toBeNull()
      })

      await act(async () => {
        await listener.current?.({ tag: "Synced" })
      })

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Error)
      })
    })

    it("flips to Degraded when service status indicates degradation", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      const listener = captureListener()

      const isOnline = jest.requireMock("@app/self-custodial/providers/is-online")
      isOnline.isDegradedStatus.mockReturnValue(true)

      const { result } = renderHook(() => useSdkLifecycle("acct-1", 0))

      await waitFor(() => {
        expect(listener.current).not.toBeNull()
      })

      await act(async () => {
        await listener.current?.({ tag: "Synced" })
      })

      await waitFor(() => {
        expect(result.current.status).toBe(ActiveWalletStatus.Degraded)
      })
    })
  })

  describe("retryCount as effect dependency (Critical #11)", () => {
    it("retries the entire init flow when retryCount changes", async () => {
      mockInitSdk.mockResolvedValue(buildSdk("sdk-1"))
      captureListener()

      const { rerender } = renderHook(
        ({ retry }: { retry: number }) => useSdkLifecycle("acct-1", retry),
        { initialProps: { retry: 0 } },
      )

      await waitFor(() => {
        expect(mockInitSdk).toHaveBeenCalledTimes(1)
      })

      rerender({ retry: 1 })

      await waitFor(() => {
        expect(mockInitSdk).toHaveBeenCalledTimes(2)
      })
    })
  })
})
