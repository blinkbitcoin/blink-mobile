import { renderHook } from "@testing-library/react-native"

import { useDashedLineFlow } from "@app/components/animations/dashed-line-flow"

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {},
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedProps: (factory: () => Record<string, number>) => factory(),
  withRepeat: jest.fn(),
  withTiming: jest.fn(),
  Easing: { linear: "linear" },
}))

describe("useDashedLineFlow", () => {
  it("returns dashArray with default values '5 5'", () => {
    const { result } = renderHook(() => useDashedLineFlow())

    expect(result.current.dashArray).toBe("5 5")
  })

  it("returns custom dashArray when params are provided", () => {
    const { result } = renderHook(() =>
      useDashedLineFlow({ dashLength: 10, gapLength: 3 }),
    )

    expect(result.current.dashArray).toBe("10 3")
  })

  it("returns animatedProps", () => {
    const { result } = renderHook(() => useDashedLineFlow())

    expect(result.current.animatedProps).toBeDefined()
  })

  it("returns animatedProps with strokeDashoffset", () => {
    const { result } = renderHook(() => useDashedLineFlow())

    expect(result.current.animatedProps).toEqual({ strokeDashoffset: 0 })
  })
})
