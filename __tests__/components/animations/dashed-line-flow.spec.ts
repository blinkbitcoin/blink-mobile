import { renderHook } from "@testing-library/react-native"
import { cancelAnimation, withRepeat, withTiming } from "react-native-reanimated"

import { useDashedLineFlow } from "@app/components/animations/dashed-line-flow"

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {},
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedProps: (factory: () => Record<string, number>) => factory(),
  withRepeat: jest.fn(),
  withTiming: jest.fn(),
  cancelAnimation: jest.fn(),
  Easing: { linear: "linear" },
}))

describe("useDashedLineFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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

  it("flows the dashes forward without end, at a steady pace", () => {
    renderHook(() => useDashedLineFlow())

    expect(withTiming).toHaveBeenCalledWith(-1000, { duration: 60000, easing: "linear" })
    expect(withRepeat).toHaveBeenCalledWith(undefined, -1, false)
  })

  it("stops the flow when its screen goes away", () => {
    const { unmount } = renderHook(() => useDashedLineFlow())
    expect(cancelAnimation).not.toHaveBeenCalled()

    unmount()

    expect(cancelAnimation).toHaveBeenCalledTimes(1)
  })
})
