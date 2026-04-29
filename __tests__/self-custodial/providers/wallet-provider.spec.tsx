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
const mockSyncSelfCustodialWallet = jest.fn()

let mockStableBalanceEnabled = true
jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({ stableBalanceEnabled: mockStableBalanceEnabled }),
}))

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
  syncSelfCustodialWallet: (...args: unknown[]) => mockSyncSelfCustodialWallet(...args),
}))

jest.mock("@app/self-custodial/logging", () => ({
  logSdkEvent: jest.fn(),
  SdkLogLevel: { Error: "error" },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
  log: jest.fn(),
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
    mockStableBalanceEnabled = true
    mockGetMnemonic.mockResolvedValue(null)
    mockGetMnemonicNetwork.mockResolvedValue("regtest")
    mockInitSdk.mockRejectedValue(new Error("SDK not available in test"))
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockAddSdkEventListener.mockResolvedValue("listener-id")
    mockSyncSelfCustodialWallet.mockResolvedValue(undefined)
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

    const { ServiceStatus } = jest.requireMock("@breeztech/breez-sdk-spark-react-native")
    const getServiceStatusMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getServiceStatus
    getServiceStatusMock.mockResolvedValue(ServiceStatus.Major)

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

  it("transitions Offline→Ready when a subsequent snapshot succeeds", async () => {
    const { listener } = setupConnectedWallet({
      getMnemonic: mockGetMnemonic,
      initSdk: mockInitSdk,
      addSdkEventListener: mockAddSdkEventListener,
    })

    const { ServiceStatus } = jest.requireMock("@breeztech/breez-sdk-spark-react-native")
    const getServiceStatusMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getServiceStatus
    getServiceStatusMock.mockResolvedValue(ServiceStatus.Major)

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
    mockStableBalanceEnabled = true
    mockGetMnemonic.mockResolvedValue(null)
    mockGetMnemonicNetwork.mockResolvedValue("regtest")
    mockInitSdk.mockRejectedValue(new Error("SDK not available in test"))
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockAddSdkEventListener.mockResolvedValue("listener-id")
    mockSyncSelfCustodialWallet.mockResolvedValue(undefined)
    mockGetUserSettings.mockResolvedValue({
      stableBalanceActiveLabel: undefined,
      sparkPrivateModeEnabled: false,
    })
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

  it("preserves Error status when isOnline=false (does not downgrade to Offline)", async () => {
    const snapshot = jest.requireMock("@app/self-custodial/providers/wallet-snapshot")
    snapshot.getSelfCustodialWalletSnapshot.mockResolvedValue({
      wallets: [],
      hasMore: false,
    })

    const { ServiceStatus } = jest.requireMock("@breeztech/breez-sdk-spark-react-native")
    const getServiceStatusMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getServiceStatus
    getServiceStatusMock.mockResolvedValue(ServiceStatus.Major)

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
    const { ServiceStatus } = jest.requireMock("@breeztech/breez-sdk-spark-react-native")
    const getServiceStatusMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getServiceStatus
    getServiceStatusMock.mockResolvedValue(ServiceStatus.Major)

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

    const { ServiceStatus } = jest.requireMock("@breeztech/breez-sdk-spark-react-native")
    const getServiceStatusMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getServiceStatus
    getServiceStatusMock.mockResolvedValue(ServiceStatus.Major)

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

    const { ServiceStatus } = jest.requireMock("@breeztech/breez-sdk-spark-react-native")
    const getServiceStatusMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getServiceStatus
    getServiceStatusMock.mockResolvedValue(ServiceStatus.Operational)

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
    const { ServiceStatus } = jest.requireMock("@breeztech/breez-sdk-spark-react-native")
    const getServiceStatusMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getServiceStatus
    getServiceStatusMock.mockResolvedValue(ServiceStatus.Operational)

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

    const { ServiceStatus } = jest.requireMock("@breeztech/breez-sdk-spark-react-native")
    const getServiceStatusMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getServiceStatus
    getServiceStatusMock.mockResolvedValue(ServiceStatus.Operational)

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

    const { ServiceStatus } = jest.requireMock("@breeztech/breez-sdk-spark-react-native")
    const getServiceStatusMock = jest.requireMock(
      "@app/self-custodial/providers/is-online",
    ).getServiceStatus
    getServiceStatusMock.mockResolvedValue(ServiceStatus.Operational)

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

    it("reports false when remote flag is off, even if the SDK reports active", async () => {
      mockStableBalanceEnabled = false
      mockGetMnemonic.mockResolvedValue("word1 word2 word3")
      mockInitSdk.mockResolvedValue({ id: "sdk" })
      mockGetUserSettings.mockResolvedValue({
        stableBalanceActiveLabel: { label: "USDB" },
        sparkPrivateModeEnabled: false,
      })

      const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

      await waitFor(() => expect(result.current.sdk).toBeTruthy())
      await waitFor(() => expect(mockGetUserSettings).toHaveBeenCalled())
      expect(result.current.isStableBalanceActive).toBe(false)
    })
  })
})
