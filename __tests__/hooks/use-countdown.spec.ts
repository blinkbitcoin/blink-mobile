import { renderHook, act } from "@testing-library/react-hooks"

import { useCountdown } from "@app/hooks/use-countdown"

describe("useCountdown", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it("returns null remainingSeconds and isExpired false when expiresAt is null", () => {
    const { result } = renderHook(() => useCountdown(null))

    expect(result.current.remainingSeconds).toBeNull()
    expect(result.current.isExpired).toBe(false)
  })

  it("computes remaining seconds from expiresAt", () => {
    const expiresAt = new Date(Date.now() + 30_000)
    const { result } = renderHook(() => useCountdown(expiresAt))

    expect(result.current.remainingSeconds).toBe(30)
    expect(result.current.isExpired).toBe(false)
  })

  it("decrements every second", () => {
    const expiresAt = new Date(Date.now() + 5_000)
    const { result } = renderHook(() => useCountdown(expiresAt))

    expect(result.current.remainingSeconds).toBe(5)

    act(() => {
      jest.advanceTimersByTime(1_000)
    })

    expect(result.current.remainingSeconds).toBe(4)

    act(() => {
      jest.advanceTimersByTime(2_000)
    })

    expect(result.current.remainingSeconds).toBe(2)
  })

  it("sets remainingSeconds to 0 and isExpired to true when expired", () => {
    const expiresAt = new Date(Date.now() + 2_000)
    const { result } = renderHook(() => useCountdown(expiresAt))

    act(() => {
      jest.advanceTimersByTime(3_000)
    })

    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.isExpired).toBe(true)
  })

  it("stops interval after expiration", () => {
    const expiresAt = new Date(Date.now() + 1_000)
    const { result } = renderHook(() => useCountdown(expiresAt))

    act(() => {
      jest.advanceTimersByTime(2_000)
    })

    expect(result.current.remainingSeconds).toBe(0)

    act(() => {
      jest.advanceTimersByTime(5_000)
    })

    expect(result.current.remainingSeconds).toBe(0)
  })

  it("resets when expiresAt changes to null", () => {
    const expiresAt = new Date(Date.now() + 10_000)
    const { result, rerender } = renderHook(
      ({ date }: { date: Date | null }) => useCountdown(date),
      { initialProps: { date: expiresAt as Date | null } },
    )

    expect(result.current.remainingSeconds).toBe(10)

    rerender({ date: null })

    expect(result.current.remainingSeconds).toBeNull()
    expect(result.current.isExpired).toBe(false)
  })

  it("restarts countdown when expiresAt changes to a new date", () => {
    const first = new Date(Date.now() + 5_000)
    const { result, rerender } = renderHook(
      ({ date }: { date: Date | null }) => useCountdown(date),
      { initialProps: { date: first as Date | null } },
    )

    expect(result.current.remainingSeconds).toBe(5)

    const second = new Date(Date.now() + 20_000)
    rerender({ date: second })

    expect(result.current.remainingSeconds).toBe(20)
  })

  it("immediately sets 0 when expiresAt is in the past", () => {
    const expiresAt = new Date(Date.now() - 5_000)
    const { result } = renderHook(() => useCountdown(expiresAt))

    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.isExpired).toBe(true)
  })

  it("cleans up interval on unmount", () => {
    const expiresAt = new Date(Date.now() + 10_000)
    const { unmount } = renderHook(() => useCountdown(expiresAt))

    unmount()

    // no act needed — just confirming no timers throw after unmount
    jest.advanceTimersByTime(5_000)
  })
})
