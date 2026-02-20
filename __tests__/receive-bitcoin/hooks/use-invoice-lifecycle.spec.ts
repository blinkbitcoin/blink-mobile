import { renderHook } from "@testing-library/react-hooks"

import { useInvoiceLifecycle } from "@app/screens/receive-bitcoin-screen/hooks/use-invoice-lifecycle"
import {
  Invoice,
  PaymentRequestState,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"

const mockCreatePaymentRequest = jest.fn()
jest.mock("@app/screens/receive-bitcoin-screen/payment/payment-request", () => ({
  createPaymentRequest: (...args: unknown[]) => mockCreatePaymentRequest(...args),
}))

const mockUseLnUpdateHashPaid = jest.fn()
jest.mock("@app/graphql/ln-update-context", () => ({
  useLnUpdateHashPaid: () => mockUseLnUpdateHashPaid(),
}))

const mockUseCountdown = jest.fn()
jest.mock("@app/hooks", () => ({
  useCountdown: (...args: unknown[]) => mockUseCountdown(...args),
}))

const mockHaptic = jest.fn()
jest.mock("react-native-haptic-feedback", () => ({
  trigger: (...args: unknown[]) => mockHaptic(...args),
}))

jest.mock("@app/graphql/generated", () => ({
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
}))

const mockMutations = {
  lnNoAmountInvoiceCreate: jest.fn(),
  lnInvoiceCreate: jest.fn(),
  lnUsdInvoiceCreate: jest.fn(),
  onChainAddressCurrent: jest.fn(),
}

type MockPR = {
  state: string
  setState: jest.Mock
  generateRequest: jest.Mock
  creationData: { id: string }
  info: unknown
  [key: string]: unknown
}

const createMockPR = (overrides: Record<string, unknown> = {}): MockPR => {
  const pr: MockPR = {
    state: PaymentRequestState.Idle,
    setState: jest.fn((state: string) => createMockPR({ ...overrides, state })),
    generateRequest: jest.fn(),
    creationData: { id: "test-prcd" },
    info: undefined,
    ...overrides,
  }
  if (!overrides.generateRequest) {
    pr.generateRequest.mockResolvedValue(pr)
  }
  return pr
}

describe("useInvoiceLifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLnUpdateHashPaid.mockReturnValue(null)
    mockUseCountdown.mockReturnValue({ remainingSeconds: 0, isExpired: false })
  })

  it("returns null pr when prcd is null", () => {
    mockCreatePaymentRequest.mockReturnValue(createMockPR())

    const { result } = renderHook(() => useInvoiceLifecycle(null, mockMutations as never))

    expect(result.current.pr).toBeNull()
    expect(mockCreatePaymentRequest).not.toHaveBeenCalled()
  })

  it("creates PR from prcd and mutations", () => {
    const mockPR = createMockPR()
    mockCreatePaymentRequest.mockReturnValue(mockPR)

    const prcd = { id: "test-prcd" }
    const { result } = renderHook(() =>
      useInvoiceLifecycle(prcd as never, mockMutations as never),
    )

    expect(mockCreatePaymentRequest).toHaveBeenCalledWith({
      mutations: mockMutations,
      creationData: prcd,
    })
    expect(result.current.pr).toBeDefined()
  })

  it("triggers invoice generation when PR is Idle", async () => {
    const generatedPR = createMockPR({ state: PaymentRequestState.Created })
    const idlePR = createMockPR({
      state: PaymentRequestState.Idle,
      generateRequest: jest.fn().mockResolvedValue(generatedPR),
    })
    mockCreatePaymentRequest.mockReturnValue(idlePR)

    const prcd = { id: "test-prcd" }
    renderHook(() => useInvoiceLifecycle(prcd as never, mockMutations as never))

    expect(idlePR.generateRequest).toHaveBeenCalled()
  })

  it("exposes regenerateInvoice callback", () => {
    mockCreatePaymentRequest.mockReturnValue(
      createMockPR({ state: PaymentRequestState.Created }),
    )

    const { result } = renderHook(() =>
      useInvoiceLifecycle({ id: "test" } as never, mockMutations as never),
    )

    expect(result.current.regenerateInvoice).toBeDefined()
    expect(typeof result.current.regenerateInvoice).toBe("function")
  })

  it("detects payment via hash matching", () => {
    const mockPR = createMockPR({
      state: PaymentRequestState.Created,
      info: {
        data: {
          invoiceType: Invoice.Lightning,
          paymentHash: "abc123",
        },
      },
    })
    mockCreatePaymentRequest.mockReturnValue(mockPR)
    mockUseLnUpdateHashPaid.mockReturnValue("abc123")

    renderHook(() => useInvoiceLifecycle({ id: "test" } as never, mockMutations as never))

    expect(mockHaptic).toHaveBeenCalledWith("notificationSuccess", {
      ignoreAndroidSystemSettings: true,
    })
  })

  it("does not trigger haptic when hash does not match", () => {
    const mockPR = createMockPR({
      state: PaymentRequestState.Created,
      info: {
        data: {
          invoiceType: Invoice.Lightning,
          paymentHash: "abc123",
        },
      },
    })
    mockCreatePaymentRequest.mockReturnValue(mockPR)
    mockUseLnUpdateHashPaid.mockReturnValue("different-hash")

    renderHook(() => useInvoiceLifecycle({ id: "test" } as never, mockMutations as never))

    expect(mockHaptic).not.toHaveBeenCalled()
  })

  it("exposes expiresInSeconds from countdown", () => {
    mockCreatePaymentRequest.mockReturnValue(
      createMockPR({ state: PaymentRequestState.Created }),
    )
    mockUseCountdown.mockReturnValue({ remainingSeconds: 300, isExpired: false })

    const { result } = renderHook(() =>
      useInvoiceLifecycle({ id: "test" } as never, mockMutations as never),
    )

    expect(result.current.expiresInSeconds).toBe(300)
  })
})
