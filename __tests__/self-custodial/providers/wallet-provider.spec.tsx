import React from "react"
import { Text } from "react-native"
import { act, render, renderHook, waitFor } from "@testing-library/react-native"

import { AccountType, ActiveWalletStatus } from "@app/types/wallet.types"

import {
  SelfCustodialWalletProvider,
  useSelfCustodialWallet,
} from "@app/self-custodial/providers/wallet-provider"

import { getWalletSnapshotMocks, setupConnectedWallet } from "./wallet-provider.fixtures"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
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
  ServiceStatus: {
    Operational: 0,
    Degraded: 1,
    Partial: 2,
    Unknown: 3,
    Major: 4,
  },
  initLogging: jest.fn(),
}))

const mockGetMnemonic = jest.fn()
const mockGetMnemonicNetwork = jest.fn()
const mockInitSdk = jest.fn()
const mockDisconnectSdk = jest.fn()
const mockAddSdkEventListener = jest.fn()
const mockGetUserSettings = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonic: () => mockGetMnemonic(),
    getMnemonicNetwork: () => mockGetMnemonicNetwork(),
  },
}))

jest.mock("@app/self-custodial/bridge", () => ({
  initSdk: (...args: unknown[]) => mockInitSdk(...args),
  disconnectSdk: (...args: unknown[]) => mockDisconnectSdk(...args),
  addSdkEventListener: (...args: unknown[]) => mockAddSdkEventListener(...args),
  getUserSettings: (...args: unknown[]) => mockGetUserSettings(...args),
  getLightningAddress: jest.fn().mockResolvedValue(null),
}))

jest.mock("@app/self-custodial/logging", () => ({
  logSdkEvent: jest.fn(),
  SdkLogLevel: { Error: "error" },
}))

const mockCrashlyticsRecordError = jest.fn()
const mockCrashlyticsLog = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockCrashlyticsRecordError(...args),
  log: (...args: unknown[]) => mockCrashlyticsLog(...args),
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: { network: 1 },
  SparkNetworkLabel: "regtest",
}))

jest.mock("@app/self-custodial/providers/validate-network", () => ({
  validateStoredNetwork: jest.fn().mockResolvedValue(true),
}))

jest.mock("@app/self-custodial/providers/is-online", () => {
  // Mirror ServiceStatus enum ordinals from the SDK mock.
  const Operational = 0
  const Degraded = 1
  return {
    OnlineState: {
      Online: "online",
      Offline: "offline",
      Unknown: "unknown",
    },
    getOnlineState: jest.fn().mockResolvedValue("online"),
    getServiceStatus: jest.fn().mockResolvedValue(Operational),
    isOnlineStatus: (s: number) => s === Operational || s === Degraded,
    isDegradedStatus: (s: number) => s === Degraded,
    isOnline: jest.fn().mockResolvedValue(true),
  }
})

jest.mock("@app/self-custodial/providers/wallet-snapshot", () => ({
  getSelfCustodialWalletSnapshot: jest.fn().mockResolvedValue([]),
  loadMoreTransactions: jest.fn().mockResolvedValue({ transactions: [], hasMore: false }),
  appendTransactions: jest.fn().mockImplementation((wallets: unknown) => wallets),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SelfCustodialWalletProvider>{children}</SelfCustodialWalletProvider>
)

describe("SelfCustodialWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMnemonic.mockResolvedValue(null)
    mockGetMnemonicNetwork.mockResolvedValue("regtest")
    mockInitSdk.mockRejectedValue(new Error("SDK not available in test"))
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockAddSdkEventListener.mockResolvedValue("listener-id")
    mockGetUserSettings.mockResolvedValue({
      stableBalanceActiveLabel: undefined,
      sparkPrivateModeEnabled: false,
    })
  })

  it("renders children", () => {
    const { getByText } = render(
      <SelfCustodialWalletProvider>
        <Text>child</Text>
      </SelfCustodialWalletProvider>,
    )

    expect(getByText("child")).toBeTruthy()
  })

  it("returns unavailable when no mnemonic exists", async () => {
    mockGetMnemonic.mockResolvedValue(null)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
    })
  })

  it("sets accountType to self-custodial", () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(result.current.accountType).toBe(AccountType.SelfCustodial)
  })

  it("provides retry function", () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(typeof result.current.retry).toBe("function")
  })

  it("default state has empty wallets", () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(result.current.wallets).toEqual([])
  })

  it("sets error status on network mismatch", async () => {
    const mockValidate = jest.requireMock(
      "@app/self-custodial/providers/validate-network",
    ).validateStoredNetwork
    mockValidate.mockResolvedValueOnce(false)
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Error)
    })

    expect(mockInitSdk).not.toHaveBeenCalled()
  })

  it("initializes SDK when network validation passes", async () => {
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockRejectedValue(new Error("SDK not available"))

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockInitSdk).toHaveBeenCalled()
    })
  })

  it("sets error status when SDK init fails", async () => {
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockRejectedValue(new Error("init failed"))

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Error)
    })
  })

  it("does not call initSdk when mnemonic is null", async () => {
    mockGetMnemonic.mockResolvedValue(null)

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockInitSdk).not.toHaveBeenCalled()
    })
  })

  it("sets Loading then Ready on successful init", async () => {
    setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })
  })

  it("initializes SDK regardless of feature flag state (rollback-safe)", async () => {
    setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    expect(mockInitSdk).toHaveBeenCalledWith("word1 word2 word3")
  })

  it("handles refresh error gracefully", async () => {
    setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })
    const { getSelfCustodialWalletSnapshot } = getWalletSnapshotMocks()
    getSelfCustodialWalletSnapshot.mockReset()
    getSelfCustodialWalletSnapshot.mockRejectedValueOnce(new Error("refresh failed"))
    getSelfCustodialWalletSnapshot.mockResolvedValue({ wallets: [], hasMore: false })

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(getSelfCustodialWalletSnapshot).toHaveBeenCalled()
    })

    expect(result.current.wallets).toEqual([])
  })

  it("triggers refresh on SDK events", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })
    const { getSelfCustodialWalletSnapshot } = getWalletSnapshotMocks()

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    getSelfCustodialWalletSnapshot.mockClear()
    await listener.current?.({ tag: "Synced" })

    expect(getSelfCustodialWalletSnapshot).toHaveBeenCalledTimes(1)
  })

  it("does not refresh on non-refresh events", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })
    const { getSelfCustodialWalletSnapshot } = getWalletSnapshotMocks()

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    getSelfCustodialWalletSnapshot.mockClear()
    await listener.current?.({ tag: "PaymentFailed" })

    expect(getSelfCustodialWalletSnapshot).not.toHaveBeenCalled()
  })

  it("coalesces rapid refresh calls", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })
    const { getSelfCustodialWalletSnapshot } = getWalletSnapshotMocks()

    let resolveFirst: () => void
    getSelfCustodialWalletSnapshot.mockReset()
    getSelfCustodialWalletSnapshot.mockImplementationOnce(
      () =>
        new Promise<{ wallets: unknown[]; hasMore: boolean }>((resolve) => {
          resolveFirst = () => resolve({ wallets: [], hasMore: false })
        }),
    )
    getSelfCustodialWalletSnapshot.mockResolvedValue({ wallets: [], hasMore: false })

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockAddSdkEventListener).toHaveBeenCalled()
    })

    // Fire event while first refresh is in-flight
    listener.current?.({ tag: "Synced" })

    // Resolve first refresh
    resolveFirst!()

    await waitFor(() => {
      // Initial refresh + event-triggered coalesced refresh
      expect(getSelfCustodialWalletSnapshot).toHaveBeenCalledTimes(2)
    })
  })

  it("disconnects SDK on unmount", async () => {
    const mockSdk = {
      addEventListener: jest.fn().mockResolvedValue("listener-id"),
      disconnect: jest.fn(),
    }
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue(mockSdk)

    const { unmount } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockInitSdk).toHaveBeenCalled()
    })

    unmount()

    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)
  })

  it("updates lastReceivedPaymentId when a PaymentSucceeded event carries a payment id", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockAddSdkEventListener).toHaveBeenCalled()
    })

    await act(async () => {
      await listener.current?.({
        tag: "PaymentSucceeded",
        inner: { payment: { id: "pay-new-42" } },
      })
    })

    expect(result.current.lastReceivedPaymentId).toBe("pay-new-42")
  })

  it("does not update lastReceivedPaymentId for non-payment refresh events", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockAddSdkEventListener).toHaveBeenCalled()
    })

    await act(async () => {
      await listener.current?.({ tag: "Synced" })
    })

    expect(result.current.lastReceivedPaymentId).toBeNull()
  })

  it("transitions Ready→Offline when snapshot fails and service status reports offline", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })

    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("offline")

    const { getSelfCustodialWalletSnapshot } = getWalletSnapshotMocks()

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    getSelfCustodialWalletSnapshot.mockReset()
    getSelfCustodialWalletSnapshot.mockRejectedValue(new Error("snapshot failed"))

    await act(async () => {
      await listener.current?.({ tag: "Synced" })
    })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Offline)
    })
  })

  it("logs to crashlytics and transitions to Error when initial refresh fails (regression Critical #7)", async () => {
    setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })
    const { getSelfCustodialWalletSnapshot } = getWalletSnapshotMocks()
    getSelfCustodialWalletSnapshot.mockReset()
    getSelfCustodialWalletSnapshot.mockRejectedValue(new Error("initial sync failed"))

    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("online")

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Error)
    })

    expect(mockCrashlyticsRecordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("initial sync failed"),
      }),
    )
  })

  it("transitions Ready→Offline on refresh failure and records error to crashlytics (Critical #7)", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })
    const { getSelfCustodialWalletSnapshot } = getWalletSnapshotMocks()
    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("online")

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    getSelfCustodialWalletSnapshot.mockRejectedValueOnce(new Error("transient sync fail"))
    getOnlineStateMock.mockResolvedValueOnce("online")

    await act(async () => {
      await listener.current?.({ tag: "Synced" })
    })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Offline)
    })

    expect(mockCrashlyticsRecordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("transient sync fail"),
      }),
    )
  })

  it("logs to crashlytics when getUserSettings fails (no longer silent — Critical #7)", async () => {
    setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })
    mockGetUserSettings.mockRejectedValue(new Error("settings boom"))

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockCrashlyticsRecordError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("getUserSettings failed"),
        }),
      )
    })
  })

  it("preserves Ready status when connectivity is 'unknown' (regression Critical #4)", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })
    const { getSelfCustodialWalletSnapshot } = getWalletSnapshotMocks()
    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    getSelfCustodialWalletSnapshot.mockRejectedValueOnce(new Error("transient"))
    getOnlineStateMock.mockResolvedValueOnce("unknown")

    await act(async () => {
      await listener.current?.({ tag: "Synced" })
    })

    expect(result.current.status).toBe(ActiveWalletStatus.Ready)
  })

  it("transitions Offline→Ready when a subsequent snapshot succeeds", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })

    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("offline")

    const { getSelfCustodialWalletSnapshot } = getWalletSnapshotMocks()

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    getSelfCustodialWalletSnapshot.mockReset()
    getSelfCustodialWalletSnapshot.mockRejectedValueOnce(new Error("snapshot failed"))
    getSelfCustodialWalletSnapshot.mockResolvedValue({ wallets: [], hasMore: false })

    await act(async () => {
      await listener.current?.({ tag: "Synced" })
    })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Offline)
    })

    await act(async () => {
      await result.current.refreshWallets()
    })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })
  })
})

describe("SelfCustodialWalletProvider — async ops, connectivity & polling", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMnemonic.mockResolvedValue(null)
    mockGetMnemonicNetwork.mockResolvedValue("regtest")
    mockInitSdk.mockRejectedValue(new Error("SDK not available in test"))
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockAddSdkEventListener.mockResolvedValue("listener-id")
    mockGetUserSettings.mockResolvedValue({
      stableBalanceActiveLabel: undefined,
      sparkPrivateModeEnabled: false,
    })
  })

  it("recovers from a snapshot that hangs past the timeout instead of staying in Loading (Critical #2)", async () => {
    jest.useFakeTimers()
    setupConnectedWallet(
      {
        getMnemonic: mockGetMnemonic,
        initSdk: mockInitSdk,
        addSdkEventListener: mockAddSdkEventListener,
      },
      { wallets: [], hasMore: false },
    )
    const snapshot = getWalletSnapshotMocks()
    snapshot.getSelfCustodialWalletSnapshot.mockImplementation(
      () =>
        new Promise(() => {
          // never resolves; should be aborted by the 5s timeout race
        }),
    )

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockInitSdk).toHaveBeenCalled()
    })

    await act(async () => {
      jest.advanceTimersByTime(5_001)
    })

    await waitFor(() => {
      expect(result.current.status).not.toBe(ActiveWalletStatus.Loading)
    })

    expect(mockCrashlyticsRecordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("wallet snapshot timed out"),
      }),
    )

    jest.useRealTimers()
  })

  it("transitions out of Loading to Error when both snapshot and connectivity check fail (Critical #4)", async () => {
    const isOnline = jest.requireMock("@app/self-custodial/providers/is-online")
    isOnline.getOnlineState.mockResolvedValueOnce("unknown")

    setupConnectedWallet(
      {
        getMnemonic: mockGetMnemonic,
        initSdk: mockInitSdk,
        addSdkEventListener: mockAddSdkEventListener,
      },
      { wallets: [], hasMore: false },
    )
    const snapshot = getWalletSnapshotMocks()
    snapshot.getSelfCustodialWalletSnapshot.mockRejectedValueOnce(
      new Error("snapshot failed"),
    )

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Error)
    })

    expect(result.current.status).not.toBe(ActiveWalletStatus.Loading)
  })

  it("loadMore calls loadMoreTransactions and appends via appendTransactions", async () => {
    setupConnectedWallet(
      {
        getMnemonic: mockGetMnemonic,
        initSdk: mockInitSdk,
        addSdkEventListener: mockAddSdkEventListener,
      },
      { wallets: [], hasMore: true },
    )
    const snapshot = getWalletSnapshotMocks()
    snapshot.loadMoreTransactions.mockResolvedValue({
      transactions: [{ id: "tx-new" }],
      hasMore: false,
    })

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.hasMoreTransactions).toBe(true)
    })

    await act(async () => {
      await result.current.loadMore()
    })

    expect(snapshot.loadMoreTransactions).toHaveBeenCalled()
    expect(snapshot.appendTransactions).toHaveBeenCalled()
    expect(result.current.hasMoreTransactions).toBe(false)
  })

  it("disconnects the SDK and skips listener registration when the provider unmounts before initSdk resolves (I11)", async () => {
    let resolveInit: (sdk: unknown) => void = () => {}
    mockInitSdk.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInit = resolve
        }),
    )
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    const fakeSdk = { id: "fake-sdk" }

    const { unmount } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockInitSdk).toHaveBeenCalled()
    })

    unmount()

    await act(async () => {
      resolveInit(fakeSdk)
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    })

    expect(mockDisconnectSdk).toHaveBeenCalledWith(fakeSdk)
    expect(mockAddSdkEventListener).not.toHaveBeenCalled()
  })

  it("preserves the loadMore cursor across refresh by passing the current raw offset to the snapshot (Critical #8)", async () => {
    const { listener } = setupConnectedWallet(
      {
        getMnemonic: mockGetMnemonic,
        initSdk: mockInitSdk,
        addSdkEventListener: mockAddSdkEventListener,
      },
      { wallets: [], hasMore: true, rawTransactionCount: 20 },
    )
    const snapshot = getWalletSnapshotMocks()
    snapshot.loadMoreTransactions.mockResolvedValue({
      transactions: [{ id: "tx-loadmore" }],
      rawCount: 20,
      hasMore: true,
    })

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    await act(async () => {
      await result.current.loadMore()
    })

    snapshot.getSelfCustodialWalletSnapshot.mockClear()
    await act(async () => {
      await listener.current?.({ tag: "Synced" })
    })

    expect(snapshot.getSelfCustodialWalletSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      40,
    )
  })

  it("preserves Error status when isOnline=false (does not downgrade to Offline)", async () => {
    const snapshot = jest.requireMock("@app/self-custodial/providers/wallet-snapshot")
    snapshot.getSelfCustodialWalletSnapshot.mockResolvedValue({
      wallets: [],
      hasMore: false,
    })

    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("offline")

    const mockValidate = jest.requireMock(
      "@app/self-custodial/providers/validate-network",
    ).validateStoredNetwork
    mockValidate.mockResolvedValueOnce(false)
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Error)
    })

    // Trigger a manual refresh while offline — Error must stay Error
    await act(async () => {
      await result.current.refreshWallets()
    })

    expect(result.current.status).toBe(ActiveWalletStatus.Error)
  })

  it("preserves Unavailable status when isOnline=false (no mnemonic case)", async () => {
    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("offline")

    mockGetMnemonic.mockResolvedValue(null)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
    })

    // refreshWallets returns early when sdkRef.current is null, so status
    // never transitions here. This confirms the Unavailable path is untouched
    // by offline detection.
    await act(async () => {
      await result.current.refreshWallets()
    })

    expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
  })

  it("transitions Loading→Offline when initial snapshot fails and service status is offline", async () => {
    const snapshot = jest.requireMock("@app/self-custodial/providers/wallet-snapshot")
    snapshot.getSelfCustodialWalletSnapshot.mockReset()
    snapshot.getSelfCustodialWalletSnapshot.mockRejectedValue(new Error("offline"))

    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("offline")

    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue({})

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Offline)
    })

    expect(snapshot.getSelfCustodialWalletSnapshot).toHaveBeenCalled()
  })

  it("polls refreshWallets every 10s while mounted", async () => {
    jest.useFakeTimers()
    const snapshot = jest.requireMock("@app/self-custodial/providers/wallet-snapshot")
    snapshot.getSelfCustodialWalletSnapshot.mockResolvedValue({
      wallets: [],
      hasMore: false,
    })

    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("online")

    const { AppState } = jest.requireActual("react-native")
    const prevAppState = AppState.currentState
    AppState.currentState = "active"

    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue({})

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    // Flush pending async init
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const initialCalls = snapshot.getSelfCustodialWalletSnapshot.mock.calls.length

    // Advance 10 seconds: one more poll tick
    await act(async () => {
      jest.advanceTimersByTime(10000)
      await Promise.resolve()
    })
    expect(snapshot.getSelfCustodialWalletSnapshot.mock.calls.length).toBeGreaterThan(
      initialCalls,
    )

    // Advance another 10 seconds: another tick
    const afterFirstTick = snapshot.getSelfCustodialWalletSnapshot.mock.calls.length
    await act(async () => {
      jest.advanceTimersByTime(10000)
      await Promise.resolve()
    })
    expect(snapshot.getSelfCustodialWalletSnapshot.mock.calls.length).toBeGreaterThan(
      afterFirstTick,
    )

    AppState.currentState = prevAppState
    jest.useRealTimers()
  })

  it("skips the 10s poll tick when AppState is not 'active'", async () => {
    jest.useFakeTimers()
    const snapshot = jest.requireMock("@app/self-custodial/providers/wallet-snapshot")
    snapshot.getSelfCustodialWalletSnapshot.mockResolvedValue({
      wallets: [],
      hasMore: false,
    })
    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("online")

    const { AppState } = jest.requireActual("react-native")
    const prevAppState = AppState.currentState
    AppState.currentState = "background"

    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue({})

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const initialCalls = snapshot.getSelfCustodialWalletSnapshot.mock.calls.length

    await act(async () => {
      jest.advanceTimersByTime(10000)
      await Promise.resolve()
    })

    expect(snapshot.getSelfCustodialWalletSnapshot.mock.calls).toHaveLength(initialCalls)

    AppState.currentState = prevAppState
    jest.useRealTimers()
  })

  it("stops polling when the provider unmounts", async () => {
    jest.useFakeTimers()
    const snapshot = jest.requireMock("@app/self-custodial/providers/wallet-snapshot")
    snapshot.getSelfCustodialWalletSnapshot.mockResolvedValue({
      wallets: [],
      hasMore: false,
    })

    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("online")

    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue({})

    const { unmount } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    unmount()
    const afterUnmount = snapshot.getSelfCustodialWalletSnapshot.mock.calls.length

    // Advance several intervals after unmount — should not trigger more calls
    await act(async () => {
      jest.advanceTimersByTime(60000)
      await Promise.resolve()
    })

    expect(snapshot.getSelfCustodialWalletSnapshot.mock.calls).toHaveLength(afterUnmount)

    jest.useRealTimers()
  })

  it("refreshes on AppState active transition", async () => {
    const { AppState } = jest.requireActual("react-native")
    const snapshot = jest.requireMock("@app/self-custodial/providers/wallet-snapshot")
    snapshot.getSelfCustodialWalletSnapshot.mockResolvedValue({
      wallets: [],
      hasMore: false,
    })

    const getOnlineStateMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getOnlineState
    getOnlineStateMock.mockResolvedValue("online")

    const listeners: Array<(state: string) => void> = []
    const addEventListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((...args: unknown[]) => {
        listeners.push(args[1] as (state: string) => void)
        return { remove: jest.fn() }
      })

    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue({})

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(addEventListenerSpy).toHaveBeenCalled()
    })

    const callsBefore = snapshot.getSelfCustodialWalletSnapshot.mock.calls.length

    await act(async () => {
      listeners.forEach((fn) => fn("active"))
      await Promise.resolve()
    })

    expect(snapshot.getSelfCustodialWalletSnapshot.mock.calls.length).toBeGreaterThan(
      callsBefore,
    )

    const callsAfterActive = snapshot.getSelfCustodialWalletSnapshot.mock.calls.length
    await act(async () => {
      listeners.forEach((fn) => fn("background"))
      await Promise.resolve()
    })

    // Background transition should NOT trigger a refresh
    expect(snapshot.getSelfCustodialWalletSnapshot.mock.calls).toHaveLength(
      callsAfterActive,
    )

    addEventListenerSpy.mockRestore()
  })

  describe("isStableBalanceActive state and refreshStableBalanceActive()", () => {
    it("defaults to false when getUserSettings returns no active label", async () => {
      mockGetMnemonic.mockResolvedValue("word1 word2 word3")
      mockInitSdk.mockResolvedValue({ id: "sdk" })
      mockGetUserSettings.mockResolvedValue({
        stableBalanceActiveLabel: undefined,
        sparkPrivateModeEnabled: false,
      })

      const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

      await waitFor(() => expect(result.current.sdk).toBeTruthy())
      await waitFor(() => expect(mockGetUserSettings).toHaveBeenCalled())
      expect(result.current.isStableBalanceActive).toBe(false)
    })

    it("reports true when getUserSettings returns an active label", async () => {
      mockGetMnemonic.mockResolvedValue("word1 word2 word3")
      mockInitSdk.mockResolvedValue({ id: "sdk" })
      mockGetUserSettings.mockResolvedValue({
        stableBalanceActiveLabel: { label: "USDB" },
        sparkPrivateModeEnabled: false,
      })

      const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

      await waitFor(() => expect(result.current.sdk).toBeTruthy())
      await waitFor(() => expect(result.current.isStableBalanceActive).toBe(true))
    })

    it("refreshStableBalanceActive() re-reads the SDK and flips the flag on change", async () => {
      mockGetMnemonic.mockResolvedValue("word1 word2 word3")
      mockInitSdk.mockResolvedValue({ id: "sdk" })
      mockGetUserSettings.mockResolvedValue({
        stableBalanceActiveLabel: undefined,
        sparkPrivateModeEnabled: false,
      })

      const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

      await waitFor(() => expect(result.current.sdk).toBeTruthy())
      await waitFor(() => expect(result.current.isStableBalanceActive).toBe(false))

      mockGetUserSettings.mockResolvedValue({
        stableBalanceActiveLabel: { label: "USDB" },
        sparkPrivateModeEnabled: false,
      })

      await act(async () => {
        await result.current.refreshStableBalanceActive()
      })

      expect(result.current.isStableBalanceActive).toBe(true)
    })

    it("refreshStableBalanceActive() is a no-op when the SDK is not connected", async () => {
      mockGetMnemonic.mockResolvedValue(null)

      const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

      await waitFor(() =>
        expect(result.current.status).toBe(ActiveWalletStatus.Unavailable),
      )

      const callsBefore = mockGetUserSettings.mock.calls.length

      await act(async () => {
        await result.current.refreshStableBalanceActive()
      })

      expect(mockGetUserSettings.mock.calls).toHaveLength(callsBefore)
    })

    it("refreshStableBalanceActive() swallows errors and keeps the flag stable", async () => {
      mockGetMnemonic.mockResolvedValue("word1 word2 word3")
      mockInitSdk.mockResolvedValue({ id: "sdk" })
      mockGetUserSettings.mockResolvedValue({
        stableBalanceActiveLabel: { label: "USDB" },
        sparkPrivateModeEnabled: false,
      })

      const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

      await waitFor(() => expect(result.current.sdk).toBeTruthy())
      await waitFor(() => expect(result.current.isStableBalanceActive).toBe(true))

      mockGetUserSettings.mockRejectedValueOnce(new Error("boom"))

      await act(async () => {
        await result.current.refreshStableBalanceActive()
      })

      expect(result.current.isStableBalanceActive).toBe(true)
    })
  })
})

describe("SelfCustodialWalletProvider — stale-write safety (Critical #5)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMnemonic.mockResolvedValue(null)
    mockGetMnemonicNetwork.mockResolvedValue("regtest")
    mockInitSdk.mockRejectedValue(new Error("SDK not available in test"))
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockAddSdkEventListener.mockResolvedValue("listener-id")
    mockGetUserSettings.mockResolvedValue({
      stableBalanceActiveLabel: undefined,
      sparkPrivateModeEnabled: false,
    })
  })

  it("ignores a stale snapshot that resolves after the SDK was replaced", async () => {
    setupConnectedWallet(
      {
        getMnemonic: mockGetMnemonic,
        initSdk: mockInitSdk,
        addSdkEventListener: mockAddSdkEventListener,
      },
      { wallets: [], hasMore: false },
    )
    const snapshot = getWalletSnapshotMocks()

    type StaleResolver = (value: {
      wallets: unknown[]
      hasMore: boolean
      rawTransactionCount: number
    }) => void
    let resolveStale: StaleResolver | null = null
    snapshot.getSelfCustodialWalletSnapshot.mockImplementationOnce(
      () =>
        new Promise<never>((resolve) => {
          resolveStale = resolve as unknown as StaleResolver
        }),
    )

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => expect(mockAddSdkEventListener).toHaveBeenCalled())

    act(() => {
      result.current.retry()
    })

    await waitFor(() => expect(mockDisconnectSdk).toHaveBeenCalled())

    snapshot.getSelfCustodialWalletSnapshot.mockResolvedValue({
      wallets: [],
      hasMore: false,
      rawTransactionCount: 0,
    })

    await act(async () => {
      resolveStale?.({
        wallets: [{ id: "stale" }],
        hasMore: true,
        rawTransactionCount: 99,
      })
    })

    expect(result.current.hasMoreTransactions).toBe(false)
  })
})
