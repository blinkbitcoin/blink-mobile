import { renderHook } from "@testing-library/react-native"

import { usePaymentObservers } from "@app/screens/send-bitcoin-screen/hooks/use-payment-observers"

/** The one observer registered today, stood in for: its own spec covers what it does
 *  with a payment; here only how the send flow reaches it matters. */
const INVESTMENT_INVOICE = "lnbc25m1investment"
const mockOnSettled = jest.fn()
const mockObserver = {
  current: {
    isObserved: (paymentRequest: string | undefined) =>
      paymentRequest?.toLowerCase() === INVESTMENT_INVOICE,
    onSettled: mockOnSettled,
  },
}
jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/use-card-investment-payment-observer",
  () => ({
    useCardInvestmentPaymentObserver: () => mockObserver.current,
  }),
)

describe("usePaymentObservers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("observes a payment one of the observers follows", () => {
    const { result } = renderHook(() => usePaymentObservers())

    expect(result.current.isObserved(INVESTMENT_INVOICE)).toBe(true)
    expect(result.current.isObserved("lnbc1someoneelse")).toBe(false)
    expect(result.current.isObserved(undefined)).toBe(false)
  })

  it("tells the observer that follows a payment when it settles", () => {
    const { result } = renderHook(() => usePaymentObservers())

    result.current.onSettled(INVESTMENT_INVOICE, "SUCCESS")

    expect(mockOnSettled).toHaveBeenCalledWith(INVESTMENT_INVOICE, "SUCCESS")
  })

  /** An observer is told about its own payments only; the rest of the send flow's
   *  traffic is not its business. */
  it("tells no observer about a payment none of them follows", () => {
    const { result } = renderHook(() => usePaymentObservers())

    result.current.onSettled("lnbc1someoneelse", "SUCCESS")

    expect(mockOnSettled).not.toHaveBeenCalled()
  })

  it("keeps the same object while no observer changes", () => {
    const { result, rerender } = renderHook(() => usePaymentObservers())
    const first = result.current

    rerender({})

    expect(result.current).toBe(first)
  })

  it("answers with a new object once an observer changes", () => {
    const { result, rerender } = renderHook(() => usePaymentObservers())
    const first = result.current

    mockObserver.current = { ...mockObserver.current }
    rerender({})

    expect(result.current).not.toBe(first)
  })
})
