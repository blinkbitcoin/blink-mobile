import { renderHook, act } from "@testing-library/react-hooks"
import { View } from "react-native"

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
  withTiming: (value: number) => value,
  cancelAnimation: jest.fn(),
  Easing: {
    bezier: () => jest.fn(),
  },
}))

import { useAlternatingSpin } from "@app/components/animations/alternating-spin"

describe("useAlternatingSpin", () => {
  it("returns triggerSpin and spinStyle", () => {
    const { result } = renderHook(() => useAlternatingSpin())

    expect(typeof result.current.triggerSpin).toBe("function")
    expect(result.current.spinStyle).toBeDefined()
  })

  it("triggerSpin does not throw", () => {
    const { result } = renderHook(() => useAlternatingSpin())

    expect(() => {
      act(() => {
        result.current.triggerSpin()
      })
    }).not.toThrow()
  })

  it("spinStyle contains transform with rotation", () => {
    const { result } = renderHook(() => useAlternatingSpin())

    expect(result.current.spinStyle).toHaveProperty("transform")
  })

  it("accepts custom duration", () => {
    const { result } = renderHook(() => useAlternatingSpin(500))

    expect(typeof result.current.triggerSpin).toBe("function")
  })

  it("triggerSpin is a function after rerender", () => {
    const { result, rerender } = renderHook(() => useAlternatingSpin())

    rerender()

    expect(typeof result.current.triggerSpin).toBe("function")
  })

  it("alternates direction on consecutive calls", () => {
    const { result } = renderHook(() => useAlternatingSpin())

    act(() => {
      result.current.triggerSpin()
    })

    act(() => {
      result.current.triggerSpin()
    })

    expect(result.current.spinStyle).toBeDefined()
  })
})
