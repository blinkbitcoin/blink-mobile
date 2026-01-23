import { renderHook, act } from "@testing-library/react-hooks"

import { useOutgoingBadgeVisibility } from "@app/components/unseen-tx-amount-badge"

describe("useOutgoingBadgeVisibility", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("returns false initially", () => {
    const { result } = renderHook(() =>
      useOutgoingBadgeVisibility({
        txId: "tx-1",
        isOutgoing: true,
        amountText: "$10",
      }),
    )

    expect(result.current).toBe(false)
  })

  it("returns false when isOutgoing is false", () => {
    const { result } = renderHook(() =>
      useOutgoingBadgeVisibility({
        txId: "tx-1",
        isOutgoing: false,
        amountText: "$10",
      }),
    )

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(result.current).toBe(false)
  })

  it("returns false when amountText is null", () => {
    const { result } = renderHook(() =>
      useOutgoingBadgeVisibility({
        txId: "tx-1",
        isOutgoing: true,
        amountText: null,
      }),
    )

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(result.current).toBe(false)
  })

  it("becomes visible after 50ms delay", () => {
    const { result } = renderHook(() =>
      useOutgoingBadgeVisibility({
        txId: "tx-1",
        isOutgoing: true,
        amountText: "$10",
      }),
    )

    expect(result.current).toBe(false)

    act(() => {
      jest.advanceTimersByTime(50)
    })

    expect(result.current).toBe(true)
  })

  it("hides after ttlMs and calls onHide", () => {
    const onHide = jest.fn()
    const ttlMs = 3000

    const { result } = renderHook(() =>
      useOutgoingBadgeVisibility({
        txId: "tx-1",
        isOutgoing: true,
        amountText: "$10",
        ttlMs,
        onHide,
      }),
    )

    act(() => {
      jest.advanceTimersByTime(50)
    })

    expect(result.current).toBe(true)
    expect(onHide).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(ttlMs)
    })

    expect(result.current).toBe(false)
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it("cleans up timeouts on unmount", () => {
    const onHide = jest.fn()

    const { unmount } = renderHook(() =>
      useOutgoingBadgeVisibility({
        txId: "tx-1",
        isOutgoing: true,
        amountText: "$10",
        onHide,
      }),
    )

    act(() => {
      jest.advanceTimersByTime(25)
    })

    unmount()

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(onHide).not.toHaveBeenCalled()
  })

  it("restarts timers when txId changes", () => {
    const onHide = jest.fn()
    const ttlMs = 1000

    const { rerender } = renderHook(
      ({ txId }) =>
        useOutgoingBadgeVisibility({
          txId,
          isOutgoing: true,
          amountText: "$10",
          ttlMs,
          onHide,
        }),
      { initialProps: { txId: "tx-1" } },
    )

    // Show badge for first tx
    act(() => {
      jest.advanceTimersByTime(50)
    })

    // Change txId before hide timeout - this cleans up old timers
    rerender({ txId: "tx-2" })

    // New timers start: wait for show (50ms) + hide (ttlMs)
    act(() => {
      jest.advanceTimersByTime(50 + ttlMs)
    })

    expect(onHide).toHaveBeenCalledTimes(1)
  })
})
