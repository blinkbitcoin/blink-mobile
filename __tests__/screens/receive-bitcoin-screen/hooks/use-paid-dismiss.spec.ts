import { renderHook } from "@testing-library/react-native"

import { usePaidDismiss } from "@app/screens/receive-bitcoin-screen/hooks/use-paid-dismiss"
import {
  PaymentRequestState,
  PaymentRequestStateType,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}))

const renderDismiss = (initial: PaymentRequestStateType) =>
  renderHook(({ state }: { state: PaymentRequestStateType }) => usePaidDismiss(state), {
    initialProps: { state: initial },
  })

describe("usePaidDismiss", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("shows the success badge on a plain receive and goes back after 5 s", () => {
    const { result, rerender } = renderDismiss(PaymentRequestState.Created)

    rerender({ state: PaymentRequestState.Paid })

    expect(result.current).toEqual({ completed: true, converting: false })
    jest.advanceTimersByTime(4999)
    expect(mockGoBack).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("shows Converting while a Dollar receive converts", () => {
    const { result, rerender } = renderDismiss(PaymentRequestState.Created)

    rerender({ state: PaymentRequestState.Converting })

    expect(result.current).toEqual({ completed: false, converting: true })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("skips the success badge and goes straight to Home once the conversion settles", () => {
    const { result, rerender } = renderDismiss(PaymentRequestState.Created)

    rerender({ state: PaymentRequestState.Converting })
    rerender({ state: PaymentRequestState.Paid })

    expect(result.current).toEqual({ completed: false, converting: true })
    expect(mockNavigate).toHaveBeenCalledWith("Primary")
    jest.advanceTimersByTime(5000)
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("does nothing before the request is paid", () => {
    renderDismiss(PaymentRequestState.Created)

    jest.advanceTimersByTime(5000)

    expect(mockGoBack).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
