import { renderHook, waitFor } from "@testing-library/react-native"

import { useAutoConvertListener } from "@app/self-custodial/hooks/use-auto-convert-listener"

const mockExecuteAutoConvert = jest.fn()
const mockWaitForPaymentCompleted = jest.fn()
const mockFindPendingAutoConvert = jest.fn()
const mockListPendingAutoConverts = jest.fn()
const mockPruneExpiredAutoConverts = jest.fn()
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
  listPendingAutoConverts: (...args: unknown[]) => mockListPendingAutoConverts(...args),
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
  mockListPendingAutoConverts.mockResolvedValue([])
  mockFindPendingAutoConvert.mockResolvedValue(undefined)
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
