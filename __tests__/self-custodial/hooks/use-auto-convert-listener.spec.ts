import { renderHook, waitFor } from "@testing-library/react-native"

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
const mockRemovePendingAutoConvert = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUsePriceConversion = jest.fn()
const mockToastShow = jest.fn()

jest.mock("@app/self-custodial/auto-convert", () => ({
  AutoConvertStatus: {
    Converted: "converted",
    AlreadyConverted: "already-converted",
    SkippedBelowMin: "skipped-below-min",
    SkippedStableBalanceActive: "skipped-stable-balance-active",
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
  removePendingAutoConvert: (...args: unknown[]) => mockRemovePendingAutoConvert(...args),
  waitForPaymentCompleted: (...args: unknown[]) => mockWaitForPaymentCompleted(...args),
}))

const AutoConvertStatus = {
  Converted: "converted",
  AlreadyConverted: "already-converted",
  SkippedBelowMin: "skipped-below-min",
  SkippedStableBalanceActive: "skipped-stable-balance-active",
  Failed: "failed",
} as const

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => mockUsePriceConversion(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: {} }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: jest.fn() }),
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

const mockSyncSelfCustodialWallet = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/self-custodial/bridge", () => ({
  syncSelfCustodialWallet: (...args: unknown[]) => mockSyncSelfCustodialWallet(...args),
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
  mockUseSelfCustodialWallet.mockReturnValue({
    sdk,
    lastReceivedPaymentId: null,
    isStableBalanceActive: false,
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
  mockRemovePendingAutoConvert.mockResolvedValue(undefined)
  mockWaitForPaymentCompleted.mockResolvedValue(true)
  mockExecuteAutoConvert.mockResolvedValue({ status: AutoConvertStatus.Converted })
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
    expect(mockToastShow).toHaveBeenCalled()
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
    })
    mockFindPendingAutoConvert.mockResolvedValue(undefined)

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockFindPendingAutoConvert).toHaveBeenCalled()
    })

    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
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
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbc1", attempts: 3 }),
    )

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1")
    })
    expect(mockExecuteAutoConvert).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("re-reads attempts from storage so concurrent invocations agree on the cap (Important #2)", async () => {
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
    })
    mockFindPendingAutoConvert.mockResolvedValue(makeRecord({ paymentRequest: "lnbc1" }))
    mockExecuteAutoConvert.mockResolvedValue({ status: AutoConvertStatus.Failed })

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalled()
    })
    expect(mockRemovePendingAutoConvert).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("drops the record silently on AlreadyConverted without any toast", async () => {
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
    mockExecuteAutoConvert.mockResolvedValue({
      status: AutoConvertStatus.AlreadyConverted,
    })

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockRemovePendingAutoConvert).toHaveBeenCalledWith("lnbc1")
    })
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("keeps the record on SkippedStableBalanceActive so a later toggle-off retries (Critical #8)", async () => {
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
    expect(mockToastShow).not.toHaveBeenCalled()
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

  it("does not bump the attempt counter on poll exhaustion (Critical #1)", async () => {
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

  it("persists a receive→conversion pairing after a successful convert (Critical #2)", async () => {
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

  it("excludes already-paired conversions from the executor's amount-tolerance check (Critical #2)", async () => {
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

  it("skips and removes the record when this receive is already paired (Critical #2 — replay safety)", async () => {
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

  it("coerces undefined isStableBalanceActive to false so the executor still runs (Critical #7 boot-window)", async () => {
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

  it("triggers a background syncWallet so the SDK materializes token balances before the convert reads them (Critical #10)", async () => {
    const sdk = makeSdk({
      getPayment: jest
        .fn()
        .mockResolvedValue({ payment: makeLightningPayment("lnbc1sync") }),
    })
    setupDefaults(sdk)
    mockUseSelfCustodialWallet.mockReturnValue({
      sdk,
      lastReceivedPaymentId: "pid-lnbc1sync",
      isStableBalanceActive: false,
    })
    mockFindPendingAutoConvert.mockResolvedValue(
      makeRecord({ paymentRequest: "lnbc1sync" }),
    )

    renderHook(() => useAutoConvertListener())

    await waitFor(() => {
      expect(mockExecuteAutoConvert).toHaveBeenCalled()
    })
    expect(mockSyncSelfCustodialWallet).toHaveBeenCalledWith(sdk)
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

  it("matches the Lightning payment case-insensitively (Important #4)", async () => {
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

  it("stamps an attempt when the matching payment is missing so the cap eventually evicts (Critical #6)", async () => {
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

  it("removes the record on the no-payment branch once attempts reach the cap (Critical #6)", async () => {
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
})
