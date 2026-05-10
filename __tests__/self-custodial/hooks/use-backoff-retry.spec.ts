import { renderHook, act } from "@testing-library/react-native"

import { useBackoffRetry } from "@app/self-custodial/hooks/use-backoff-retry"

const DELAYS = [1000, 3000, 9000] as const

describe("useBackoffRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("schedules the retry callback after the first delay", () => {
    const retry = jest.fn()
    const { result } = renderHook(() => useBackoffRetry(DELAYS))

    act(() => {
      result.current.schedule(retry)
    })

    expect(retry).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(999)
    })
    expect(retry).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("walks the delay sequence on successive schedule calls", () => {
    const retry = jest.fn()
    const { result } = renderHook(() => useBackoffRetry(DELAYS))

    act(() => {
      result.current.schedule(retry)
    })
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(retry).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.schedule(retry)
    })
    act(() => {
      jest.advanceTimersByTime(2999)
    })
    expect(retry).toHaveBeenCalledTimes(1)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(retry).toHaveBeenCalledTimes(2)

    act(() => {
      result.current.schedule(retry)
    })
    act(() => {
      jest.advanceTimersByTime(9000)
    })
    expect(retry).toHaveBeenCalledTimes(3)
  })

  it("becomes a no-op after the delay sequence is exhausted", () => {
    const retry = jest.fn()
    const { result } = renderHook(() => useBackoffRetry(DELAYS))

    for (const delay of DELAYS) {
      act(() => {
        result.current.schedule(retry)
      })
      act(() => {
        jest.advanceTimersByTime(delay)
      })
    }
    expect(retry).toHaveBeenCalledTimes(DELAYS.length)

    act(() => {
      result.current.schedule(retry)
    })
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(retry).toHaveBeenCalledTimes(DELAYS.length)
  })

  it("schedule replaces a pending timer with the next delay", () => {
    const retry = jest.fn()
    const { result } = renderHook(() => useBackoffRetry(DELAYS))

    act(() => {
      result.current.schedule(retry)
    })
    // Re-schedule before the first timer fires; only the last scheduled timer
    // should fire, with the SECOND delay (counter advanced).
    act(() => {
      result.current.schedule(retry)
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(retry).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("reset rewinds the counter and cancels any pending timer", () => {
    const retry = jest.fn()
    const { result } = renderHook(() => useBackoffRetry(DELAYS))

    act(() => {
      result.current.schedule(retry)
    })
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(retry).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.schedule(retry)
    })
    act(() => {
      result.current.reset()
    })
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(retry).toHaveBeenCalledTimes(1)

    // After reset the counter is 0 again — next schedule uses the first delay.
    act(() => {
      result.current.schedule(retry)
    })
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(retry).toHaveBeenCalledTimes(2)
  })

  it("cancels any pending timer on unmount", () => {
    const retry = jest.fn()
    const { result, unmount } = renderHook(() => useBackoffRetry(DELAYS))

    act(() => {
      result.current.schedule(retry)
    })

    unmount()

    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(retry).not.toHaveBeenCalled()
  })

  it("does nothing when the delays array is empty", () => {
    const retry = jest.fn()
    const { result } = renderHook(() => useBackoffRetry([]))

    act(() => {
      result.current.schedule(retry)
    })
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(retry).not.toHaveBeenCalled()
  })
})
