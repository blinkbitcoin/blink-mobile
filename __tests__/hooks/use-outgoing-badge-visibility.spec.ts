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

    // The interrupted first tx is marked seen on cleanup, the second on its own timer
    act(() => {
      jest.advanceTimersByTime(50 + ttlMs)
    })

    expect(onHide).toHaveBeenCalledTimes(2)
  })

  /** A send replaced by a newer one before its timer fires was still shown, so it owes the
   *  same mark-seen. Without it the first send stays unseen until its detail is opened. */
  it("marks a shown badge seen when a newer transaction supersedes it", () => {
    const onHide = jest.fn()

    const { rerender } = renderHook(
      ({ txId, amountText }) =>
        useOutgoingBadgeVisibility({
          txId,
          isOutgoing: true,
          amountText,
          ttlMs: 5000,
          onHide,
        }),
      { initialProps: { txId: "tx-btc", amountText: "-0.001 BTC" } },
    )

    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(onHide).not.toHaveBeenCalled()

    rerender({ txId: "tx-usd", amountText: "-$5.00" })

    expect(onHide).toHaveBeenCalledTimes(1)
  })

  /** The flag that makes the above work must not reach a badge that never painted: that is
   *  the one parked behind an incoming announcement, and marking it would hide a
   *  transaction the user was never shown. */
  it("does not mark a badge seen when it is superseded before it paints", () => {
    const onHide = jest.fn()

    const { rerender } = renderHook(
      ({ txId }) =>
        useOutgoingBadgeVisibility({
          txId,
          isOutgoing: true,
          amountText: "$10",
          onHide,
        }),
      { initialProps: { txId: "tx-1" } },
    )

    act(() => {
      jest.advanceTimersByTime(25)
    })

    rerender({ txId: "tx-2" })

    expect(onHide).not.toHaveBeenCalled()
  })

  it("does not mark a badge seen when it is parked before it paints", () => {
    const onHide = jest.fn()

    const { rerender } = renderHook(
      ({ isOutgoing }) =>
        useOutgoingBadgeVisibility({
          txId: "tx-1",
          isOutgoing,
          amountText: "$10",
          onHide,
        }),
      { initialProps: { isOutgoing: true } },
    )

    act(() => {
      jest.advanceTimersByTime(25)
    })

    rerender({ isOutgoing: false })

    expect(onHide).not.toHaveBeenCalled()
  })

  it("marks a shown badge seen when it is parked behind an incoming announcement", () => {
    const onHide = jest.fn()

    const { rerender } = renderHook(
      ({ isOutgoing }) =>
        useOutgoingBadgeVisibility({
          txId: "tx-1",
          isOutgoing,
          amountText: "$10",
          onHide,
        }),
      { initialProps: { isOutgoing: true } },
    )

    act(() => {
      jest.advanceTimersByTime(50)
    })

    rerender({ isOutgoing: false })

    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it("marks a shown badge seen on unmount", () => {
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
      jest.advanceTimersByTime(50)
    })

    unmount()

    expect(onHide).toHaveBeenCalledTimes(1)
  })

  /** A hide already paid for must not be paid twice: the second call would mark whatever
   *  transaction is latest by then, which may be one the badge never announced. */
  it("does not mark seen a second time after the hide timer already did", () => {
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

    act(() => {
      jest.advanceTimersByTime(50 + ttlMs)
    })
    expect(onHide).toHaveBeenCalledTimes(1)

    rerender({ txId: "tx-1-again" })

    expect(onHide).toHaveBeenCalledTimes(1)
  })
})
