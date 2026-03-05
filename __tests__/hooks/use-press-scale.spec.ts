import { renderHook, act } from "@testing-library/react-hooks"

import { usePressScale } from "@app/components/animations/press-scale"

describe("usePressScale", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it("returns scaleValue, pressIn, and pressOut", () => {
    const { result } = renderHook(() => usePressScale())

    expect(result.current.scaleValue).toBeDefined()
    expect(typeof result.current.pressIn).toBe("function")
    expect(typeof result.current.pressOut).toBe("function")
  })

  it("initializes scale value", () => {
    const { result } = renderHook(() => usePressScale())

    expect(result.current.scaleValue).toBeTruthy()
  })

  it("pressIn does not throw", () => {
    const { result } = renderHook(() => usePressScale())

    expect(() => {
      act(() => {
        result.current.pressIn()
        jest.advanceTimersByTime(200)
      })
    }).not.toThrow()
  })

  it("pressOut does not throw", () => {
    const { result } = renderHook(() => usePressScale())

    expect(() => {
      act(() => {
        result.current.pressOut()
        jest.advanceTimersByTime(100)
      })
    }).not.toThrow()
  })

  it("accepts custom parameters", () => {
    const { result } = renderHook(() => usePressScale(0.9, 300, 150))

    expect(result.current.scaleValue).toBeDefined()
  })

  it("returns stable references across renders", () => {
    const { result, rerender } = renderHook(() => usePressScale())

    const firstPressIn = result.current.pressIn
    const firstPressOut = result.current.pressOut

    rerender()

    expect(result.current.pressIn).toBe(firstPressIn)
    expect(result.current.pressOut).toBe(firstPressOut)
  })
})
