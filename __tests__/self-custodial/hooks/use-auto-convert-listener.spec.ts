import { act, renderHook, waitFor } from "@testing-library/react-native"

import { useAutoConvertListener } from "@app/self-custodial/hooks/use-auto-convert-listener"

const mockExecuteAutoConvert = jest.fn()
const mockWaitForPaymentCompleted = jest.fn()
const mockFindPendingAutoConvert = jest.fn()
const mockFindRecentConversionId = jest.fn()
const mockListPendingAutoConverts = jest.fn()
const mockListAutoConvertPairings = jest.fn()
const mockMarkAutoConvertPairing = jest.fn()
const mockPruneExpiredAutoConverts = jest.fn()
const mockPruneExpiredAutoConvertPairings = jest.fn()
const mockRecordAutoConvertAttempt = jest.fn()
const mockReleaseAutoConvertAttempt = jest.fn()
const mockRemovePendingAutoConvert = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUsePriceConversion = jest.fn()
const mockRefreshWallets = jest.fn()

jest.mock("@app/self-custodial/auto-convert", () => ({
  AutoConvertStatus: {
    Converted: "converted",
    AlreadyConverted: "already-converted",
    SkippedBelowMin: "skipped-below-min",
    SkippedStableBalanceActive: "skipped-stable-balance-active",
    Deferred: "deferred",
    Failed: "failed",
  },
  executeAutoConvert: (...args: unknown[]) => mockExecuteAutoConvert(...args),
  findPendingAutoConvert: (...args: unknown[]) => mockFindPendingAutoConvert(...args),
  findRecentConversionId: (...args: unknown[]) => mockFindRecentConversionId(...args),
  listAutoConvertPairings: (...args: unknown[]) => mockListAutoConvertPairings(...args),
  listPendingAutoConverts: (...args: unknown[]) => mockListPendingAutoConverts(...args),
  markAutoConvertPairing: (...args: unknown[]) => mockMarkAutoConvertPairing(...args),
  pruneExpiredAutoConvertPairings: (...args: unknown[]) =>
    mockPruneExpiredAutoConvertPairings(...args),
  pruneExpiredAutoConverts: (...args: unknown[]) => mockPruneExpiredAutoConverts(...args),
  recordAutoConvertAttempt: (...args: unknown[]) => mockRecordAutoConvertAttempt(...args),
  releaseAutoConvertAttempt: (...args: unknown[]) =>
    mockReleaseAutoConvertAttempt(...args),
  removePendingAutoConvert: (...args: unknown[]) => mockRemovePendingAutoConvert(...args),
  waitForPaymentCompleted: (...args: unknown[]) => mockWaitForPaymentCompleted(...args),
}))

const AutoConvertStatus = {
  Converted: "converted",
  AlreadyConverted: "already-converted",
  SkippedBelowMin: "skipped-below-min",
  SkippedStableBalanceActive: "skipped-stable-balance-active",
  Deferred: "deferred",
  Failed: "failed",
} as const

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => mockUsePriceConversion(),
}))

let mockIsAnonMode = false
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

let mockHasSparkToken = true
jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useHasSparkToken: () => mockHasSparkToken,
}))

const mockAddBounded = jest.fn()
jest.mock("@app/utils/bounded-collections", () => {
  const actual = jest.requireActual("@app/utils/bounded-collections")
  return {
    ...actual,
    addBounded: (...args: unknown[]) => {
      mockAddBounded(...args)
      return actual.addBounded(...args)
    },
  }
})

// Regression guard: the listener must stay silent. If anyone re-introduces a
// toast on auto-convert outcomes, this mock crashes the test loudly.
jest.mock("@app/utils/toast", () => ({
  toastShow: () => {
    throw new Error("auto-convert listener must not surface a toast")
  },
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: jest.fn(), log: jest.fn() }),
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  GetPaymentRequest: { create: (p: unknown) => p },
  ListPaymentsRequest: { create: (p: unknown) => p },
  PaymentDetails: {
    Lightning: {
      instanceOf: (d: unknown) =>
        typeof d === "object" &&
        d !== null &&
        (d as { tag?: string }).tag === "Lightning",
    },
  },
}))

type ListenerSdk = {
  getPayment: jest.Mock
  listPayments: jest.Mock
}

const makeSdk = (overrides: Partial<ListenerSdk> = {}): ListenerSdk => ({
  getPayment: jest.fn(),
  listPayments: jest.fn(),
  ...overrides,
})

const makeLightningPayment = (invoice: string, amount = 5000n) => ({
  id: `pid-${invoice}`,
  amount,
  details: { tag: "Lightning", inner: { invoice } },
})

/** The bridge's delivery window for a lost conversion, and the listener's cooldown. */
const DELIVERY_WINDOW_MS = 5 * 60 * 1000
const RETRY_COOLDOWN_MS = 30_000

const baseRemoteConfig = {
  autoConvertMaxAttempts: 3,
  autoConvertPollMaxAttempts: 7,
  autoConvertPollIntervalMs: 2000,
}

const makeRecord = (overrides: Partial<Record<string, unknown>> = {}) => ({
  paymentRequest: "lnbc1",
  amountSats: 5000,
  createdAtMs: 1_000_000,
  attempts: 0,
  lastAttemptAtMs: undefined,
  ...overrides,
})

const setupDefaults = (sdk: ListenerSdk) => {
  mockIsAnonMode = false
  mockHasSparkToken = true
  mockUseSelfCustodialWallet.mockReturnValue({
    sdk,
    lastReceivedPaymentId: null,
    isStableBalanceActive: false,
    refreshWallets: mockRefreshWallets,
  })
  mockUseRemoteConfig.mockReturnValue(baseRemoteConfig)
  mockUsePriceConversion.mockReturnValue({
    convertMoneyAmount: (a: { amount: number }) => ({ amount: a.amount }),
  })
  mockPruneExpiredAutoConverts.mockResolvedValue(undefined)
  mockPruneExpiredAutoConvertPairings.mockResolvedValue(undefined)
  mockListPendingAutoConverts.mockResolvedValue([])
  mockListAutoConvertPairings.mockResolvedValue([])
  mockMarkAutoConvertPairing.mockResolvedValue(undefined)
  mockFindPendingAutoConvert.mockResolvedValue(undefined)
  mockFindRecentConversionId.mockResolvedValue(undefined)
  mockRecordAutoConvertAttempt.mockResolvedValue(undefined)
  mockReleaseAutoConvertAttempt.mockResolvedValue(undefined)
  mockRemovePendingAutoConvert.mockResolvedValue(undefined)
  mockWaitForPaymentCompleted.mockResolvedValue(true)
  mockExecuteAutoConvert.mockResolvedValue({ status: AutoConvertStatus.Converted })
  mockRefreshWallets.mockResolvedValue(undefined)
}

describe("useAutoConvertListener — live trigger", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does nothing when there is no lastReceivedPaymentId", () => {
    const sdk = makeSdk()
    setupDefaults(sdk)

    renderHook(() => useAutoConvertListener())

    expect(sdk.getPayment).not.toHaveBeenCalled()
  })

  it("runs the full convert pipeline when a pending record matches the received payment", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1dollar", 5000n) }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1dollar",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    const record = makeRecord({ paymentRequest: "lnbc1dollar" })
    mockFindPendingAutoConvert.mockResolvedValue(record)

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })

    expect(mockRecordAutoConvertAttempt).toHaveBeenCalledWith(
      "lnbc1dollar",
      expect.any(Number),
    )
    expect(mockWaitForPaymentCompleted).toHaveBeenCalledWith(sdk, "pid-lnbc1dollar", {
      maxAttempts: baseRemoteConfig.autoConvertPollMaxAttempts,
      intervalMs: baseRemoteConfig.autoConvertPollIntervalMs,
    })
    expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1dollar")
    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
  })

  it("ignores a received payment while Anon Mode is on", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1dollar", 5000n) }),
    })
    setupDefaults(sdk)
    mockIsAnonMode = true
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1dollar",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbc1dollar" }),
    )

    renderHook(() => useAutoConvertListener())
    await Promise.resolve()

    expect(sdk.getPayment).not.toHaveBeenCalled()
    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
  })

  it("processes the still-unhandled payment once Anon Mode turns off", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1dollar", 5000n) }),
    })
    setupDefaults(sdk)
    mockIsAnonMode = true
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1dollar",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbc1dollar" }),
    )

    const { rerender } = renderHook(() => useAutoConvertListener())
    await Promise.resolve()
    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()

    mockIsAnonMode = false
    rerender({})

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  /** The token cannot appear mid-session; flipping it is what proves the hold held a
   *  payment the listener would otherwise have converted. */
  it("holds a received payment on a network with no dollar token", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1dollar", 5000n) }),
    })
    setupDefaults(sdk)
    mockHasSparkToken = false
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1dollar",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbc1dollar" }),
    )

    const { rerender } = renderHook(() => useAutoConvertListener())
    await Promise.resolve()
    expect(sdk.getPayment).not.toHaveBeenCalled()
    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()

    mockHasSparkToken = true
    rerender({})

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  it("does not refresh wallets when the convert outcome is Failed", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockExecuteAutoConvert.mockResolvedValue({ status: AutoConvertStatus.Failed })

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalled()
    })
    expect(mockRefreshWallets).not.toHaveBeenCalled()
  })

  it("does not run convert when waitForPaymentCompleted times out", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockWaitForPaymentCompleted.mockResolvedValue(false)

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockWaitForPaymentCompleted).toHaveBeenCalled()
    })
    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
  })

  it("leaves the record pending when the convert outcome is Failed", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockExecuteAutoConvert.mockResolvedValue({ status: AutoConvertStatus.Failed })

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalled()
    })
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
  })

  it("skips when the paid invoice has no pending record", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1bitcoin") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1bitcoin",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(undefined)

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockFindPendingAutoConvert).toHaveBeenCalled()
    })

    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
  })

  it("drops the record without running when attempts reached the cap", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbc1", attempts: 3 }),
    )

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1")
    })
    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
  })

  it("re-reads attempts from storage so concurrent invocations agree on the cap", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
    })
    // Snapshot the listener loaded shows attempts:2 (one below the cap of 3).
    // By the time runAutoConvert reads live storage, a sibling invocation has
    // already stamped, so live attempts:3 — runAutoConvert must evict, not run.
    mockFindPendingAutoConvert
      .mockResolvedValueOnce(makeRecord({ paymentRequest: "lnbc1", attempts: 2 }))
      .mockResolvedValueOnce(makeRecord({ paymentRequest: "lnbc1", attempts: 3 }))

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1")
    })
    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
  })

  it("leaves the record pending when Failed so a later trigger retries", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockExecuteAutoConvert.mockResolvedValue({ status: AutoConvertStatus.Failed })

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalled()
    })
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
  })

  it("drops the record silently on AlreadyConverted", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockExecuteAutoConvert.mockResolvedValue({
      status: AutoConvertStatus.AlreadyConverted,
    })

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1")
    })
  })

  it("keeps the record on SkippedStableBalanceActive so a later toggle-off retries", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: true,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockExecuteAutoConvert.mockResolvedValue({
      status: AutoConvertStatus.SkippedStableBalanceActive,
    })

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalled()
    })
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
  })

  it("returns without running convert when waitForPaymentCompleted times out", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockWaitForPaymentCompleted.mockResolvedValue(false)

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockWaitForPaymentCompleted).toHaveBeenCalled()
    })
    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
  })

  it("does not bump the attempt counter on poll exhaustion", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockWaitForPaymentCompleted.mockResolvedValue(false)

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockWaitForPaymentCompleted).toHaveBeenCalled()
    })
    expect(mockRecordAutoConvertAttempt).not.toHaveBeenCalled()
  })

  it("deduplicates the same paymentId across rerenders", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))

    const { rerender } = renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })

    rerender({})
    rerender({})

    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
  })

  it("passes the remote-configured max attempts / poll options through", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockUseRemoteConfig.mockReturnValue({
      autoConvertMaxAttempts: 5,
      autoConvertPollMaxAttempts: 9,
      autoConvertPollIntervalMs: 1500,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockWaitForPaymentCompleted).toHaveBeenCalled()
    })

    expect(mockWaitForPaymentCompleted).toHaveBeenCalledWith(sdk, "pid-lnbc1", {
      maxAttempts: 9,
      intervalMs: 1500,
    })
  })

  it("persists a receive→conversion pairing after a successful convert", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1B", 5000n) }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1B",
      isStableBalanceActive: false,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1B" }))
    mockFindRecentConversionId.mockResolvedValue("conv-pid-B")

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockMarkAutoConvertPairing).toHaveBeenCalledTimes(1)
    })

    expect(mockMarkAutoConvertPairing).toHaveBeenCalledWith({
      receivePaymentId: "pid-lnbc1B",
      conversionPaymentId: "conv-pid-B",
      pairedAtMs: expect.any(Number),
    })
  })

  it("excludes already-paired conversions from the executor's amount-tolerance check", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1B", 5000n) }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1B",
      isStableBalanceActive: false,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1B" }))
    mockListAutoConvertPairings.mockResolvedValue([
      {
        receivePaymentId: "pid-lnbc1A",
        conversionPaymentId: "conv-pid-A",
        pairedAtMs: 100,
      },
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })

    const passedClaimedSet = mockExecuteAutoConvert.mock.calls[0][1]
      .claimedConversionIds as ReadonlySet<string>
    expect(passedClaimedSet.has("conv-pid-A")).toBe(true)
  })

  it("skips and removes the record when this receive is already paired (replay safety)", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1B", 5000n) }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1B",
      isStableBalanceActive: false,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1B" }))
    mockListAutoConvertPairings.mockResolvedValue([
      {
        receivePaymentId: "pid-lnbc1B",
        conversionPaymentId: "conv-pid-B",
        pairedAtMs: 100,
      },
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1B")
    })
    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
  })

  it("coerces undefined isStableBalanceActive to false so the executor still runs (boot-window)", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1boot", 5000n) }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1boot",
      isStableBalanceActive: undefined,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbc1boot" }),
    )

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
    expect(mockExecuteAutoConvert).toHaveBeenCalledWith(
      sdk,
      expect.objectContaining({ isStableBalanceActive: false }),
    )
  })
})

describe("useAutoConvertListener — mount replay", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("prunes expired records, then processes remaining pending ones", async () => {
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [makeLightningPayment("lnbc1pending")],
      }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1pending" }),
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
    expect(mockPruneExpiredAutoConverts).toHaveBeenCalledWith(expect.any(Number))
  })

  it("holds the replay while Anon Mode is on and runs it after leaving", async () => {
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [makeLightningPayment("lnbc1pending")],
      }),
    })
    setupDefaults(sdk)
    mockIsAnonMode = true
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1pending" }),
    ])

    const { rerender } = renderHook(() => useAutoConvertListener())
    await Promise.resolve()
    expect(mockListPendingAutoConverts).not.toHaveBeenCalled()

    mockIsAnonMode = false
    rerender({})

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  it("holds the replay on a network with no dollar token", async () => {
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [makeLightningPayment("lnbc1pending")],
      }),
    })
    setupDefaults(sdk)
    mockHasSparkToken = false
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1pending" }),
    ])

    const { rerender } = renderHook(() => useAutoConvertListener())
    /** The prune is the replay's first, synchronous step: the pending list is only read
     *  after it resolves, so asserting on that list here would pass either way. */
    expect(mockPruneExpiredAutoConverts).not.toHaveBeenCalled()

    mockHasSparkToken = true
    rerender({})

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  it("re-arms the replay after an Anon interval so every pending record is picked up", async () => {
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [makeLightningPayment("lnbc1pending")],
      }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([])

    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => {
      expect(mockListPendingAutoConverts).toHaveBeenCalledTimes(1)
    })

    mockIsAnonMode = true
    rerender({})

    mockIsAnonMode = false
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1pending" }),
    ])
    rerender({})

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  it("skips a pending record whose Lightning payment isn't in the recent history", async () => {
    const sdk = makeSdk({ listPayments: jest.fn().mockResolvedValue({ payments: [] }) })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1unseen" }),
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockListPendingAutoConverts).toHaveBeenCalled()
    })

    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
  })

  it("matches the Lightning payment case-insensitively", async () => {
    // SDK normalisation could return the invoice with different casing than
    // the record persisted; Bolt11 is case-insensitive so the match must be too.
    const recordInvoice = "lnbc1MIXEDcase"
    const sdkInvoice = "lnbc1mixedcase"
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [
          {
            id: "pid-mixed",
            amount: 5000n,
            details: { tag: "Lightning", inner: { invoice: sdkInvoice } },
          },
        ],
      }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: recordInvoice }),
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalled()
    })
  })

  it("stamps an attempt when the matching payment is missing so the cap eventually evicts", async () => {
    const sdk = makeSdk({ listPayments: jest.fn().mockResolvedValue({ payments: [] }) })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1unseen", attempts: 0 }),
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockRecordAutoConvertAttempt).toHaveBeenCalledWith(
        "lnbc1unseen",
        expect.any(Number),
      )
    })
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
  })

  it("removes the record on the no-payment branch once attempts reach the cap", async () => {
    const sdk = makeSdk({ listPayments: jest.fn().mockResolvedValue({ payments: [] }) })
    setupDefaults(sdk)
    // baseRemoteConfig.autoConvertMaxAttempts === 3; stamp would make it 3, hitting cap.
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1capped", attempts: 2 }),
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1capped")
    })
    expect(mockRecordAutoConvertAttempt).not.toHaveBeenCalled()
  })

  it("skips replay entirely when the pending list is empty", async () => {
    const sdk = makeSdk()
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockListPendingAutoConverts).toHaveBeenCalled()
    })
    expect(sdk.listPayments).not.toHaveBeenCalled()
  })

  it("dedups live and replay racing the same paymentRequest via inFlightInvoicesRef", async () => {
    // Both effects fire on mount; both target the same invoice. Only one
    // convert must run — the second path should see the inFlight ref populated
    // by the first and skip cleanly.
    const sdk = makeSdk({
      getPayment: jest.fn().mockResolvedValue({ payment: makeLightningPayment("lnbc1") }),
      listPayments: jest.fn().mockResolvedValue({
        payments: [
          {
            id: "pid-lnbc1",
            amount: 5000n,
            details: { tag: "Lightning", inner: { invoice: "lnbc1" } },
          },
        ],
      }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1" }),
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalled()
    })
    // Give any pending replay-path microtasks a chance to flush.
    await new Promise((resolve) => {
      setTimeout(resolve, 10)
    })
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
  })

  it("processes pending records sequentially via reduce, not in parallel", async () => {
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [
          {
            id: "pid-A",
            amount: 5000n,
            details: { tag: "Lightning", inner: { invoice: "lnbc1A" } },
          },
          {
            id: "pid-B",
            amount: 5000n,
            details: { tag: "Lightning", inner: { invoice: "lnbc1B" } },
          },
        ],
      }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1A" }),
      makeRecord({ paymentRequest: "lnbc1B" }),
    ])

    let resolveFirst!: (value: boolean) => void
    const firstSettled = new Promise<boolean>((resolve) => {
      resolveFirst = resolve
    })
    mockWaitForPaymentCompleted
      .mockImplementationOnce(() => firstSettled)
      .mockResolvedValueOnce(true)

    renderHook(() => useAutoConvertListener())

    // The reduce chain awaits the first record's processing before starting
    // the second; until we resolve the first, the second must not have started.
    await new Promise((resolve) => {
      setTimeout(resolve, 10)
    })
    expect(mockWaitForPaymentCompleted).toHaveBeenCalledTimes(1)

    resolveFirst(true)

    await waitFor(() => {
      expect(mockWaitForPaymentCompleted).toHaveBeenCalledTimes(2)
    })
  })

  it("removes the record on SkippedBelowMin without firing the success toast", async () => {
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [
          {
            id: "pid-low",
            amount: 100n,
            details: { tag: "Lightning", inner: { invoice: "lnbc1low" } },
          },
        ],
      }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbc1low" }),
    ])
    mockExecuteAutoConvert.mockResolvedValue({
      status: AutoConvertStatus.SkippedBelowMin,
    })

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1low")
    })
  })
})

describe("useAutoConvertListener — receives of one amount converting at once", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /** The wallet as the executor sees it: conversions go out one at a time, as the bridge
   *  runs them, and one already in the history that no receive has claimed is taken for
   *  these sats, as `isConvertedInHistory` takes it. */
  /** Conversions are named per wallet: claims the listener keeps while the app runs
   *  never match another test's. */
  let walletsMade = 0
  const walletConvertingOneAtATime = () => {
    walletsMade += 1
    const walletName = `wallet-${walletsMade}`
    const history: string[] = []
    const pairings: Array<{ receivePaymentId: string; conversionPaymentId: string }> = []
    let landFirst: () => void = () => undefined
    let bridgeTurn: Promise<unknown> = Promise.resolve()
    mockListAutoConvertPairings.mockImplementation(async () => [...pairings])
    mockMarkAutoConvertPairing.mockImplementation(async (pairing) => {
      pairings.push(pairing)
    })
    /** The history shows none of them yet, as a conversion whose legs are still
     *  syncing: the pairing has only what the bridge names. */
    mockFindRecentConversionId.mockResolvedValue(undefined)
    mockExecuteAutoConvert.mockImplementation(
      (
        _sdk: unknown,
        { claimedConversionIds }: { claimedConversionIds: Set<string> },
      ) => {
        const turn = bridgeTurn.then(async () => {
          const isTakenAsConverted = history.some((id) => !claimedConversionIds.has(id))
          if (isTakenAsConverted) return { status: AutoConvertStatus.AlreadyConverted }
          if (history.length === 0) {
            await new Promise<void>((resolve) => {
              landFirst = resolve
            })
          }
          const conversionPaymentId = `${walletName}-conversion-${history.length + 1}`
          history.push(conversionPaymentId)
          return { status: AutoConvertStatus.Converted, conversionPaymentId }
        })
        bridgeTurn = turn.catch(() => undefined)
        return turn
      },
    )
    const conversion = (n: number) => `${walletName}-conversion-${n}`
    return { history, pairings, conversion, landFirst: () => landFirst() }
  }

  it("converts and pairs each of two receives of one amount whose conversions overlap, before the history shows them", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn(async ({ paymentId }: { paymentId: string }) => ({
        payment: makeLightningPayment(paymentId.replace("pid-", ""), 5000n),
      })),
    })
    setupDefaults(sdk)
    const wallet = {
      sdk,
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    }
    mockFindPendingAutoConvert.mockImplementation(async (invoice: string) =>
      makeRecord({
        paymentRequest: invoice,
        createdAtMs: invoice === "lnbcFirst" ? 1_000_000 : 1_000_500,
      }),
    )
    const { history, pairings, conversion, landFirst } = walletConvertingOneAtATime()
    mockUseSelfCustodialWallet.mockReturnValue({
      ...wallet,
      lastReceivedPaymentId: "pid-lnbcFirst",
    })
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1))

    mockUseSelfCustodialWallet.mockReturnValue({
      ...wallet,
      lastReceivedPaymentId: "pid-lnbcSecond",
    })
    rerender({})
    await waitFor(() => expect(mockRecordAutoConvertAttempt).toHaveBeenCalledTimes(2))
    landFirst()

    await waitFor(() => expect(mockRemovePendingAutoConvert).toHaveBeenCalledTimes(2))
    expect(history).toEqual([conversion(1), conversion(2)])
    expect(pairings).toEqual([
      expect.objectContaining({
        receivePaymentId: "pid-lnbcFirst",
        conversionPaymentId: conversion(1),
      }),
      expect.objectContaining({
        receivePaymentId: "pid-lnbcSecond",
        conversionPaymentId: conversion(2),
      }),
    ])
  })

  /** A conversion paired while the app runs is claimed for the next receive at once, so
   *  a pairing that does not reach storage cannot hand the first one's to the second. */
  it("keeps the first receive's conversion claimed for the second when its pairing is not stored", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn(async ({ paymentId }: { paymentId: string }) => ({
        payment: makeLightningPayment(paymentId.replace("pid-", ""), 5000n),
      })),
    })
    setupDefaults(sdk)
    const wallet = {
      sdk,
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    }
    mockFindPendingAutoConvert.mockImplementation(async (invoice: string) =>
      makeRecord({ paymentRequest: invoice }),
    )
    const { history, conversion, landFirst } = walletConvertingOneAtATime()
    mockMarkAutoConvertPairing.mockRejectedValueOnce(new Error("storage unavailable"))
    mockUseSelfCustodialWallet.mockReturnValue({
      ...wallet,
      lastReceivedPaymentId: "pid-lnbcUnstored",
    })
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1))

    mockUseSelfCustodialWallet.mockReturnValue({
      ...wallet,
      lastReceivedPaymentId: "pid-lnbcAfter",
    })
    rerender({})
    await waitFor(() => expect(mockRecordAutoConvertAttempt).toHaveBeenCalledTimes(2))
    landFirst()

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbcAfter"),
    )
    expect(history).toEqual([conversion(1), conversion(2)])
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalledWith("lnbcUnstored")
  })

  /** A receive whose conversion went out but whose pairing did not reach storage is
   *  converted already: tried again, it stores the pairing, and converts nothing more. */
  it("stores the pairing of a receive that converted before trying it again, converting nothing more", async () => {
    const sdk = makeSdk({
      listPayments: jest
        .fn()
        .mockResolvedValue({ payments: [makeLightningPayment("lnbcPairLater")] }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbcPairLater" }),
    ])
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbcPairLater" }),
    )
    mockExecuteAutoConvert.mockResolvedValue({
      status: AutoConvertStatus.Converted,
      conversionPaymentId: "conversion-paired-later",
    })
    mockMarkAutoConvertPairing.mockRejectedValueOnce(new Error("storage unavailable"))
    const first = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockMarkAutoConvertPairing).toHaveBeenCalledTimes(1))
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
    first.unmount()

    renderHook(() => useAutoConvertListener())

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbcPairLater"),
    )
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    expect(mockMarkAutoConvertPairing).toHaveBeenLastCalledWith(
      expect.objectContaining({
        receivePaymentId: "pid-lnbcPairLater",
        conversionPaymentId: "conversion-paired-later",
      }),
    )
  })

  /** Its last allowed attempt converted, and its pairing did not reach storage: the next
   *  trigger stores the pairing before the attempt cap could drop the receive, and
   *  converts nothing more. */
  it("stores the pairing of a receive whose last allowed attempt converted before the cap drops it", async () => {
    const record: { attempts: number; lastAttemptAtMs: number | undefined } = makeRecord({
      paymentRequest: "lnbcLastAttempt",
      attempts: 2,
    })
    const sdk = makeSdk({
      listPayments: jest
        .fn()
        .mockResolvedValue({ payments: [makeLightningPayment("lnbcLastAttempt")] }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockImplementation(async () => [{ ...record }])
    mockFindPendingAutoConvert.mockImplementation(async () => ({ ...record }))
    mockRecordAutoConvertAttempt.mockImplementation(async (_: string, atMs: number) => {
      record.attempts += 1
      record.lastAttemptAtMs = atMs
    })
    mockExecuteAutoConvert.mockResolvedValue({
      status: AutoConvertStatus.Converted,
      conversionPaymentId: "conversion-of-the-last-attempt",
    })
    mockMarkAutoConvertPairing.mockRejectedValueOnce(new Error("storage unavailable"))
    const first = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockMarkAutoConvertPairing).toHaveBeenCalledTimes(1))
    first.unmount()
    record.lastAttemptAtMs = 0

    renderHook(() => useAutoConvertListener())

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbcLastAttempt"),
    )
    expect(record.attempts).toBe(3)
    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    expect(mockMarkAutoConvertPairing).toHaveBeenCalledTimes(2)
    expect(mockMarkAutoConvertPairing).toHaveBeenLastCalledWith(
      expect.objectContaining({
        receivePaymentId: "pid-lnbcLastAttempt",
        conversionPaymentId: "conversion-of-the-last-attempt",
      }),
    )
  })

  /** Stored in its turn: a receive converting meanwhile reads the conversions claimed in
   *  its own turn, and the pairing waits for it rather than landing while it reads. */
  it("stores a converted receive's pairing only once the receive converting ahead of it is done", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbcConverting") }),
      listPayments: jest.fn().mockResolvedValue({
        payments: [
          makeLightningPayment("lnbcPairWaits"),
          makeLightningPayment("lnbcConverting"),
        ],
      }),
    })
    setupDefaults(sdk)
    mockFindPendingAutoConvert.mockImplementation(async (invoice: string) =>
      makeRecord({ paymentRequest: invoice }),
    )
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbcPairWaits" }),
    ])
    mockExecuteAutoConvert.mockResolvedValueOnce({
      status: AutoConvertStatus.Converted,
      conversionPaymentId: "conversion-pair-waits",
    })
    mockMarkAutoConvertPairing.mockRejectedValueOnce(new Error("storage unavailable"))
    const first = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockMarkAutoConvertPairing).toHaveBeenCalledTimes(1))
    first.unmount()

    let finishConverting: (outcome: unknown) => void = () => undefined
    mockExecuteAutoConvert.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishConverting = resolve
        }),
    )
    let releaseReplay: (records: unknown[]) => void = () => undefined
    mockListPendingAutoConverts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseReplay = resolve
        }),
    )
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbcConverting",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(2))
    releaseReplay([makeRecord({ paymentRequest: "lnbcPairWaits" })])
    await waitFor(() => expect(mockFindPendingAutoConvert).toHaveBeenCalledTimes(3))
    for (let turn = 0; turn < 10; turn += 1) await act(async () => undefined)
    const storedWhileConverting = mockMarkAutoConvertPairing.mock.calls.length

    finishConverting({
      status: AutoConvertStatus.Converted,
      conversionPaymentId: "conversion-ahead",
    })

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbcPairWaits"),
    )
    expect(storedWhileConverting).toBe(1)
    expect(
      mockMarkAutoConvertPairing.mock.calls.map(
        ([pairing]) => pairing.conversionPaymentId,
      ),
    ).toEqual(["conversion-pair-waits", "conversion-ahead", "conversion-pair-waits"])
  })

  /** The conversion the history shows for a receive is paired before the receive goes,
   *  so no other receive takes it for its own after a restart. */
  it("pairs a receive with the conversion the history shows before removing it", async () => {
    const sdk = makeSdk({
      listPayments: jest
        .fn()
        .mockResolvedValue({ payments: [makeLightningPayment("lnbcFoundConverted")] }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbcFoundConverted" }),
    ])
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbcFoundConverted" }),
    )
    mockExecuteAutoConvert.mockResolvedValue({
      status: AutoConvertStatus.AlreadyConverted,
      conversionPaymentId: "conversion-in-history",
    })

    renderHook(() => useAutoConvertListener())

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbcFoundConverted"),
    )
    expect(mockMarkAutoConvertPairing).toHaveBeenCalledWith(
      expect.objectContaining({
        receivePaymentId: "pid-lnbcFoundConverted",
        conversionPaymentId: "conversion-in-history",
      }),
    )
  })

  it("keeps a receive the history shows converted while its pairing cannot be stored", async () => {
    const sdk = makeSdk({
      listPayments: jest
        .fn()
        .mockResolvedValue({ payments: [makeLightningPayment("lnbcFoundUnstored")] }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({ paymentRequest: "lnbcFoundUnstored" }),
    ])
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbcFoundUnstored" }),
    )
    mockExecuteAutoConvert.mockResolvedValue({
      status: AutoConvertStatus.AlreadyConverted,
      conversionPaymentId: "conversion-found-unstored",
    })
    mockMarkAutoConvertPairing.mockRejectedValueOnce(new Error("storage unavailable"))

    renderHook(() => useAutoConvertListener())

    await waitFor(() => expect(mockMarkAutoConvertPairing).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith(
        "auto-convert-listener replay",
        expect.any(Error),
      ),
    )
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
  })

  it("lets the next receive convert after one whose turn failed", async () => {
    const sdk = makeSdk({
      getPayment: jest.fn(async ({ paymentId }: { paymentId: string }) => ({
        payment: makeLightningPayment(paymentId.replace("pid-", ""), 5000n),
      })),
    })
    setupDefaults(sdk)
    const wallet = {
      sdk,
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    }
    mockFindPendingAutoConvert.mockImplementation(async (invoice: string) =>
      makeRecord({ paymentRequest: invoice }),
    )
    mockExecuteAutoConvert
      .mockRejectedValueOnce(new Error("bridge unavailable"))
      .mockResolvedValue({ status: AutoConvertStatus.Converted })
    mockUseSelfCustodialWallet.mockReturnValue({
      ...wallet,
      lastReceivedPaymentId: "pid-lnbcFailing",
    })
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1))

    mockUseSelfCustodialWallet.mockReturnValue({
      ...wallet,
      lastReceivedPaymentId: "pid-lnbcNext",
    })
    rerender({})

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbcNext"),
    )
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalledWith("lnbcFailing")
  })
})

describe("useAutoConvertListener — waiting behind an earlier conversion", () => {
  let movedClock: jest.SpyInstance | undefined

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    movedClock?.mockRestore()
    movedClock = undefined
  })

  it("takes back the attempt of a try that only waited, keeping the record", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1dollar", 5000n) }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1dollar",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbc1dollar" }),
    )
    mockExecuteAutoConvert.mockResolvedValue({
      status: AutoConvertStatus.Deferred,
      retryAfterMs: DELIVERY_WINDOW_MS,
    })

    renderHook(() => useAutoConvertListener())

    await waitFor(() =>
      expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledWith("lnbc1dollar"),
    )
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
    expect(mockRefreshWallets).not.toHaveBeenCalled()
  })

  /** A lost conversion's window starts anew on every launch: launches that each retry
   *  within it must not use the receive's attempts up and drop it unconverted. */
  it("keeps a receive through launches that each wait behind the earlier conversion, converting it once one can", async () => {
    const record: { attempts: number; lastAttemptAtMs: number | undefined } = makeRecord({
      paymentRequest: "lnbc1pending",
    })
    const waitingLaunches = baseRemoteConfig.autoConvertMaxAttempts + 2
    let nowMs = 2_000_000
    movedClock = jest.spyOn(Date, "now").mockImplementation(() => nowMs)

    for (let launch = 1; launch <= waitingLaunches + 1; launch += 1) {
      const sdk = makeSdk({
        listPayments: jest
          .fn()
          .mockResolvedValue({ payments: [makeLightningPayment("lnbc1pending")] }),
      })
      setupDefaults(sdk)
      mockFindPendingAutoConvert.mockImplementation(async () => ({ ...record }))
      mockListPendingAutoConverts.mockImplementation(async () => [{ ...record }])
      mockRecordAutoConvertAttempt.mockImplementation(async (_: string, atMs: number) => {
        record.attempts += 1
        record.lastAttemptAtMs = atMs
      })
      mockReleaseAutoConvertAttempt.mockImplementation(async () => {
        record.attempts = Math.max(0, record.attempts - 1)
      })
      const isLastLaunch = launch > waitingLaunches
      mockExecuteAutoConvert.mockResolvedValue({
        status: isLastLaunch ? AutoConvertStatus.Converted : AutoConvertStatus.Deferred,
        retryAfterMs: DELIVERY_WINDOW_MS,
      })
      const { unmount } = renderHook(() => useAutoConvertListener())
      await waitFor(() => expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(launch))
      await waitFor(() =>
        expect(
          isLastLaunch ? mockRemovePendingAutoConvert : mockReleaseAutoConvertAttempt,
        ).toHaveBeenCalled(),
      )
      unmount()
      if (!isLastLaunch) {
        expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
        mockReleaseAutoConvertAttempt.mockClear()
      }
      /** Each launch comes after the cooldown, and within the earlier conversion's window
       *  as that launch counts it. */
      nowMs += 60_000
    }

    expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1pending")
    expect(record.attempts).toBe(1)
  })
})

describe("useAutoConvertListener — trying a waiting receive again", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** A pending receive whose attempts are kept as storage keeps them. */
  const pendingReceive = () => {
    const record: { attempts: number; lastAttemptAtMs: number | undefined } = makeRecord({
      paymentRequest: "lnbc1waiting",
    })
    const sdk = makeSdk({
      listPayments: jest
        .fn()
        .mockResolvedValue({ payments: [makeLightningPayment("lnbc1waiting")] }),
    })
    setupDefaults(sdk)
    mockFindPendingAutoConvert.mockImplementation(async () => ({ ...record }))
    mockListPendingAutoConverts.mockImplementation(async () => [{ ...record }])
    mockRecordAutoConvertAttempt.mockImplementation(async (_: string, atMs: number) => {
      record.attempts += 1
      record.lastAttemptAtMs = atMs
    })
    mockReleaseAutoConvertAttempt.mockImplementation(async () => {
      record.attempts = Math.max(0, record.attempts - 1)
    })
    mockExecuteAutoConvert
      .mockResolvedValueOnce({
        status: AutoConvertStatus.Deferred,
        retryAfterMs: DELIVERY_WINDOW_MS,
      })
      .mockResolvedValue({ status: AutoConvertStatus.Converted })
  }

  const advance = async (ms: number) => {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ms)
    })
  }

  it("tries a receive that waited again once the wait and the cooldown are over, in the same launch", async () => {
    pendingReceive()
    renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))

    await advance(DELIVERY_WINDOW_MS + RETRY_COOLDOWN_MS - 1000)
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    await advance(1000)

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1waiting"),
    )
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(2)
  })

  it("tries each receive that waited again after its own wait, leaving the rest alone", async () => {
    pendingReceive()
    mockListPendingAutoConverts.mockImplementation(async () => [
      makeRecord({ paymentRequest: "lnbc1waiting" }),
      makeRecord({ paymentRequest: "lnbc1alsoWaiting" }),
    ])
    mockFindPendingAutoConvert.mockImplementation(async (invoice: string) =>
      makeRecord({ paymentRequest: invoice }),
    )
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [
          makeLightningPayment("lnbc1waiting"),
          makeLightningPayment("lnbc1alsoWaiting"),
        ],
      }),
    })
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: null,
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockExecuteAutoConvert
      .mockReset()
      .mockResolvedValueOnce({
        status: AutoConvertStatus.Deferred,
        retryAfterMs: DELIVERY_WINDOW_MS,
      })
      .mockResolvedValueOnce({ status: AutoConvertStatus.Deferred, retryAfterMs: 0 })
      .mockResolvedValue({ status: AutoConvertStatus.Converted })
    renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(2))

    await advance(RETRY_COOLDOWN_MS)
    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1alsoWaiting"),
    )
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalledWith("lnbc1waiting")
    await advance(DELIVERY_WINDOW_MS)

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1waiting"),
    )
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(4)
    expect(mockListPendingAutoConverts).toHaveBeenCalledTimes(1)
  })

  /** The bridge settles a lost transfer of the user's it finds, for their next transfer
   *  to be told of, and asks for no wait: the receive behind it converts in the same
   *  launch, with no transfer of the user's in between, before its record could lapse. */
  it("converts a receive that waited behind the user's own lost transfer in the same launch", async () => {
    pendingReceive()
    mockExecuteAutoConvert
      .mockReset()
      .mockResolvedValueOnce({ status: AutoConvertStatus.Deferred, retryAfterMs: 0 })
      .mockResolvedValue({ status: AutoConvertStatus.Converted })
    renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))

    await advance(RETRY_COOLDOWN_MS)

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1waiting"),
    )
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(2)
    expect(mockListPendingAutoConverts).toHaveBeenCalledTimes(1)
  })

  it("leaves an unpaid receive alone while it tries a waiting one again", async () => {
    pendingReceive()
    mockListPendingAutoConverts.mockImplementation(async () => [
      makeRecord({ paymentRequest: "lnbc1waiting" }),
      makeRecord({ paymentRequest: "lnbc1unpaid" }),
    ])
    mockFindPendingAutoConvert.mockImplementation(async (invoice: string) =>
      makeRecord({ paymentRequest: invoice }),
    )
    renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))

    await advance(DELIVERY_WINDOW_MS + RETRY_COOLDOWN_MS)

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1waiting"),
    )
    expect(
      mockRecordAutoConvertAttempt.mock.calls.filter(
        ([invoice]) => invoice === "lnbc1unpaid",
      ),
    ).toHaveLength(1)
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalledWith("lnbc1unpaid")
  })

  it("replays nothing again when it renders anew with nothing to try again", async () => {
    pendingReceive()
    mockExecuteAutoConvert
      .mockReset()
      .mockResolvedValue({ status: AutoConvertStatus.Failed })
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1))

    mockUsePriceConversion.mockReturnValue({
      convertMoneyAmount: (a: { amount: number }) => ({ amount: a.amount }),
    })
    rerender({})
    await advance(1000)

    expect(mockListPendingAutoConverts).toHaveBeenCalledTimes(1)
  })

  it("replaces the pending retry of a receive that waits again", async () => {
    pendingReceive()
    const sdk = makeSdk({
      listPayments: jest
        .fn()
        .mockResolvedValue({ payments: [makeLightningPayment("lnbc1waiting")] }),
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1waiting") }),
    })
    const wallet = {
      sdk,
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    }
    mockUseSelfCustodialWallet.mockReturnValue({ ...wallet, lastReceivedPaymentId: null })
    mockExecuteAutoConvert
      .mockReset()
      .mockResolvedValueOnce({
        status: AutoConvertStatus.Deferred,
        retryAfterMs: DELIVERY_WINDOW_MS,
      })
      .mockResolvedValueOnce({
        status: AutoConvertStatus.Deferred,
        retryAfterMs: DELIVERY_WINDOW_MS,
      })
      .mockResolvedValue({ status: AutoConvertStatus.Converted })
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))
    await advance(RETRY_COOLDOWN_MS + 1000)
    mockUseSelfCustodialWallet.mockReturnValue({
      ...wallet,
      lastReceivedPaymentId: "pid-lnbc1waiting",
    })
    rerender({})
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(2))

    await advance(DELIVERY_WINDOW_MS)
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(2)
    await advance(RETRY_COOLDOWN_MS + 1000)

    await waitFor(() => expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(3))
    expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1waiting")
  })

  it("holds a retry that comes while Anon Mode is on, running it once the mode is off", async () => {
    pendingReceive()
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))

    mockIsAnonMode = true
    rerender({})
    await advance(DELIVERY_WINDOW_MS + RETRY_COOLDOWN_MS)
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    mockIsAnonMode = false
    rerender({})

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1waiting"),
    )
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(2)
  })

  it("holds a retry that comes while the wallet is gone, running it once it is back", async () => {
    pendingReceive()
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))
    const wallet = mockUseSelfCustodialWallet.mock.results[0].value

    mockUseSelfCustodialWallet.mockReturnValue({
      sdk: undefined,
      lastReceivedPaymentId: null,
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    rerender({})
    await advance(DELIVERY_WINDOW_MS + RETRY_COOLDOWN_MS)
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    mockUseSelfCustodialWallet.mockReturnValue(wallet)
    rerender({})

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1waiting"),
    )
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(2)
    const lookupsOnceRun = mockFindPendingAutoConvert.mock.calls.length
    rerender({})
    rerender({})
    await advance(1000)
    expect(mockFindPendingAutoConvert).toHaveBeenCalledTimes(lookupsOnceRun)
  })

  it("holds a retry that comes while the price is not known, running it once it is", async () => {
    pendingReceive()
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))
    const price = mockUsePriceConversion.mock.results[0].value

    mockUsePriceConversion.mockReturnValue({ convertMoneyAmount: undefined })
    rerender({})
    await advance(DELIVERY_WINDOW_MS + RETRY_COOLDOWN_MS)
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    mockUsePriceConversion.mockReturnValue(price)
    rerender({})

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1waiting"),
    )
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(2)
  })

  it("holds a retry that comes on a network with no dollar token, running it once there is one", async () => {
    pendingReceive()
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))

    mockHasSparkToken = false
    rerender({})
    await advance(DELIVERY_WINDOW_MS + RETRY_COOLDOWN_MS)
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    mockHasSparkToken = true
    rerender({})

    await waitFor(() =>
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1waiting"),
    )
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(2)
  })

  it("runs a retry with the listener as it is when the retry fires", async () => {
    pendingReceive()
    const { rerender } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))
    const wallet = mockUseSelfCustodialWallet.mock.results[0].value

    mockUseSelfCustodialWallet.mockReturnValue({ ...wallet, isStableBalanceActive: true })
    rerender({})
    await advance(DELIVERY_WINDOW_MS + RETRY_COOLDOWN_MS)

    await waitFor(() => expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(2))
    expect(mockExecuteAutoConvert.mock.calls[1][1]).toEqual(
      expect.objectContaining({ isStableBalanceActive: true }),
    )
  })

  it("reports a retry that fails, trying nothing", async () => {
    pendingReceive()
    renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))

    mockFindPendingAutoConvert.mockRejectedValue(new Error("storage unavailable"))
    await advance(DELIVERY_WINDOW_MS + RETRY_COOLDOWN_MS)

    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith(
        "auto-convert-listener retry",
        expect.any(Error),
      ),
    )
    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
  })

  it("tries nothing again once the listener is gone", async () => {
    pendingReceive()
    const { unmount } = renderHook(() => useAutoConvertListener())
    await waitFor(() => expect(mockReleaseAutoConvertAttempt).toHaveBeenCalledTimes(1))

    unmount()
    expect(jest.getTimerCount()).toBe(0)
    await advance(DELIVERY_WINDOW_MS + RETRY_COOLDOWN_MS)

    expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
  })
})

describe("useAutoConvertListener — isRetryableNow gate", () => {
  const FIXED_NOW = 2_000_000_000_000

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("blocks the live-trigger run when lastAttemptAtMs is within the 30s cooldown", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1cool") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1cool",
      isStableBalanceActive: false,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({
        paymentRequest: "lnbc1cool",
        attempts: 1,
        lastAttemptAtMs: FIXED_NOW - 5_000,
      }),
    )

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockFindPendingAutoConvert).toHaveBeenCalled()
    })
    await Promise.resolve()

    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
    expect(mockRecordAutoConvertAttempt).not.toHaveBeenCalled()
  })

  it("allows the live-trigger run once the 30s cooldown has elapsed", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1past") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1past",
      isStableBalanceActive: false,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({
        paymentRequest: "lnbc1past",
        attempts: 1,
        lastAttemptAtMs: FIXED_NOW - 35_000,
      }),
    )

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  it("recovers an orphan record on the live-trigger when lastAttemptAtMs is past the 2-minute timeout", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1orph") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1orph",
      isStableBalanceActive: false,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({
        paymentRequest: "lnbc1orph",
        attempts: 1,
        lastAttemptAtMs: FIXED_NOW - 3 * 60 * 1000,
      }),
    )

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  it("blocks the mount-replay run when lastAttemptAtMs is within the 30s cooldown", async () => {
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [makeLightningPayment("lnbc1replaycool")],
      }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({
        paymentRequest: "lnbc1replaycool",
        attempts: 1,
        lastAttemptAtMs: FIXED_NOW - 5_000,
      }),
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockListPendingAutoConverts).toHaveBeenCalled()
    })
    await Promise.resolve()

    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
  })

  it("allows the mount-replay run when the 2-minute orphan timeout has elapsed", async () => {
    const sdk = makeSdk({
      listPayments: jest.fn().mockResolvedValue({
        payments: [makeLightningPayment("lnbc1replayorph")],
      }),
    })
    setupDefaults(sdk)
    mockListPendingAutoConverts.mockResolvedValue([
      makeRecord({
        paymentRequest: "lnbc1replayorph",
        attempts: 1,
        lastAttemptAtMs: FIXED_NOW - 3 * 60 * 1000,
      }),
    ])

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalledTimes(1)
    })
  })
})

describe("useAutoConvertListener — bounded Sets", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("routes processedPaymentIdsRef additions through addBounded with the 200-entry cap", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1", 5000n) }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(undefined)

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockAddBounded).toHaveBeenCalledWith(expect.any(Set), "pid-lnbc1", 200)
    })
  })

  it("routes inFlightInvoicesRef additions through addBounded with the 50-entry cap", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc-bounded", 5000n) }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-bounded",
      isStableBalanceActive: false,
      refreshWallets: mockRefreshWallets,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbc-bounded" }),
    )

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockAddBounded).toHaveBeenCalledWith(expect.any(Set), "lnbc-bounded", 50)
    })
  })
})
