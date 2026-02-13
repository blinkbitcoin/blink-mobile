import { renderHook, act } from "@testing-library/react-hooks"

import { WalletCurrency } from "@app/graphql/generated"
import { useIncomingBadgeAutoSeen } from "@app/components/unseen-tx-amount-badge/use-incoming-badge-auto-seen"

type AutoSeenProps = {
  isFocused: boolean
  isOutgoing: boolean | undefined
  unseenCurrency: WalletCurrency | undefined
  delayMs?: number
  markTxSeen: (currency: WalletCurrency) => void
}

describe("useIncomingBadgeAutoSeen", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const defaultProps = {
    isFocused: true,
    isOutgoing: false,
    unseenCurrency: WalletCurrency.Btc,
    delayMs: 5000,
    markTxSeen: jest.fn(),
  }

  it("calls markTxSeen after the delay when focused with an incoming tx", () => {
    const markTxSeen = jest.fn()
    renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, markTxSeen }),
    )

    expect(markTxSeen).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(markTxSeen).toHaveBeenCalledWith(WalletCurrency.Btc)
    expect(markTxSeen).toHaveBeenCalledTimes(1)
  })

  it("does not fire for outgoing transactions", () => {
    const markTxSeen = jest.fn()
    renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, isOutgoing: true, markTxSeen }),
    )

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(markTxSeen).not.toHaveBeenCalled()
  })

  it("does not fire when isOutgoing is undefined", () => {
    const markTxSeen = jest.fn()
    renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, isOutgoing: undefined, markTxSeen }),
    )

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(markTxSeen).not.toHaveBeenCalled()
  })

  it("does not fire when screen is not focused", () => {
    const markTxSeen = jest.fn()
    renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, isFocused: false, markTxSeen }),
    )

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(markTxSeen).not.toHaveBeenCalled()
  })

  it("does not fire when unseenCurrency is undefined", () => {
    const markTxSeen = jest.fn()
    renderHook(() =>
      useIncomingBadgeAutoSeen({
        ...defaultProps,
        unseenCurrency: undefined,
        markTxSeen,
      }),
    )

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(markTxSeen).not.toHaveBeenCalled()
  })

  it("clears the timer when screen loses focus before delay", () => {
    const markTxSeen = jest.fn()
    const { rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      { initialProps: { ...defaultProps, markTxSeen } as AutoSeenProps },
    )

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(markTxSeen).not.toHaveBeenCalled()

    rerender({ ...defaultProps, isFocused: false, markTxSeen })

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(markTxSeen).not.toHaveBeenCalled()
  })

  it("does not re-schedule for the same currency on rerender", () => {
    const markTxSeen = jest.fn()
    const { rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      { initialProps: { ...defaultProps, markTxSeen } as AutoSeenProps },
    )

    // Rerender with same props shouldn't reset the timer
    rerender({ ...defaultProps, markTxSeen })
    rerender({ ...defaultProps, markTxSeen })

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(markTxSeen).toHaveBeenCalledTimes(1)
  })

  it("schedules a new timer when currency changes", () => {
    const markTxSeen = jest.fn()
    const { rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      { initialProps: { ...defaultProps, markTxSeen } as AutoSeenProps },
    )

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(markTxSeen).toHaveBeenCalledWith(WalletCurrency.Btc)

    rerender({ ...defaultProps, unseenCurrency: WalletCurrency.Usd, markTxSeen })

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(markTxSeen).toHaveBeenCalledWith(WalletCurrency.Usd)
    expect(markTxSeen).toHaveBeenCalledTimes(2)
  })

  it("respects custom delayMs", () => {
    const markTxSeen = jest.fn()
    renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, delayMs: 2000, markTxSeen }),
    )

    act(() => {
      jest.advanceTimersByTime(1999)
    })

    expect(markTxSeen).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })

    expect(markTxSeen).toHaveBeenCalledTimes(1)
  })

  it("fires when screen regains focus after being unfocused", () => {
    const markTxSeen = jest.fn()
    const { rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      { initialProps: { ...defaultProps, isFocused: false, markTxSeen } as AutoSeenProps },
    )

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(markTxSeen).not.toHaveBeenCalled()

    rerender({ ...defaultProps, isFocused: true, markTxSeen })

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(markTxSeen).toHaveBeenCalledWith(WalletCurrency.Btc)
  })
})
