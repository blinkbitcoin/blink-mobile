import { act, renderHook } from "@testing-library/react-hooks"
import { useDebouncedEffect } from "@app/hooks/use-debounce"

describe("useDebouncedEffect", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it("should call callback after delay on trailing edge", () => {
    const callback = jest.fn()

    renderHook(() => useDebouncedEffect(callback, 500, []))

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should call callback immediately when delay is zero", () => {
    const callback = jest.fn()

    renderHook(() => useDebouncedEffect(callback, 0, []))

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should not call callback when enabled is false", () => {
    const callback = jest.fn()

    renderHook(() => useDebouncedEffect(callback, 500, [], { enabled: false }))

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it("should call callback immediately with leading option", () => {
    const callback = jest.fn()

    renderHook(() => useDebouncedEffect(callback, 500, [], { leading: true }))

    expect(callback).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it("should not call callback on trailing edge when trailing is false", () => {
    const callback = jest.fn()

    renderHook(() => useDebouncedEffect(callback, 500, [], { trailing: false }))

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it("should reset debounce when dependencies change", () => {
    const callback = jest.fn()
    const { rerender } = renderHook(
      ({ dep }) => useDebouncedEffect(callback, 500, [dep]),
      { initialProps: { dep: 1 } },
    )

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(callback).not.toHaveBeenCalled()

    rerender({ dep: 2 })

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should cancel pending callback when cancel is called", () => {
    const callback = jest.fn()
    const { result } = renderHook(() => useDebouncedEffect(callback, 500, []))

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      result.current.cancel()
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it("should immediately execute pending callback when flush is called", () => {
    const callback = jest.fn()
    const { result } = renderHook(() => useDebouncedEffect(callback, 500, []))

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      result.current.flush()
    })

    expect(callback).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should return true from isPending when callback is pending", () => {
    const callback = jest.fn()
    const { result } = renderHook(() => useDebouncedEffect(callback, 500, []))

    expect(result.current.isPending()).toBe(true)

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current.isPending()).toBe(false)
  })

  it("should clear timeout when component unmounts", () => {
    const callback = jest.fn()
    const { unmount } = renderHook(() => useDebouncedEffect(callback, 500, []))

    act(() => {
      jest.advanceTimersByTime(250)
    })

    unmount()

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it("should clear timeout when enabled changes to false", () => {
    const callback = jest.fn()
    const { rerender } = renderHook(
      ({ enabled }) => useDebouncedEffect(callback, 500, [], { enabled }),
      { initialProps: { enabled: true } },
    )

    act(() => {
      jest.advanceTimersByTime(250)
    })

    rerender({ enabled: false })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it("should only call leading once until trailing executes", () => {
    const callback = jest.fn()
    const { rerender } = renderHook(
      ({ dep }) => useDebouncedEffect(callback, 500, [dep], { leading: true }),
      { initialProps: { dep: 1 } },
    )

    expect(callback).toHaveBeenCalledTimes(1)

    rerender({ dep: 2 })

    expect(callback).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(callback).toHaveBeenCalledTimes(2)

    rerender({ dep: 3 })

    expect(callback).toHaveBeenCalledTimes(3)
  })

  it("should use latest callback reference on execution", () => {
    let counter = 0
    const callback = jest.fn(() => {
      counter += 1
    })
    const { rerender } = renderHook(({ cb }) => useDebouncedEffect(cb, 500, []), {
      initialProps: { cb: callback },
    })

    counter = 10

    const newCallback = jest.fn(() => {
      counter += 1
    })
    rerender({ cb: newCallback })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(newCallback).toHaveBeenCalledTimes(1)
    expect(counter).toBe(11)
  })
})
