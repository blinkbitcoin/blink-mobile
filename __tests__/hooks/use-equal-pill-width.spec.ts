import { act, renderHook } from "@testing-library/react-hooks"
import type { LayoutChangeEvent } from "react-native"

import { useEqualPillWidth } from "@app/components/atomic/currency-pill/use-equal-pill-width"

const layoutEvent = (width: number) =>
  ({
    nativeEvent: { layout: { width } },
  }) as LayoutChangeEvent

describe("useEqualPillWidth", () => {
  it("keeps width undefined until both pill widths are known", () => {
    const { result } = renderHook(() => useEqualPillWidth())

    act(() => {
      result.current.onPillLayout("BTC")(layoutEvent(80))
    })

    expect(result.current.widthStyle).toBeUndefined()
  })

  it("uses the larger pill width once both are measured", () => {
    const { result } = renderHook(() => useEqualPillWidth())

    act(() => {
      result.current.onPillLayout("BTC")(layoutEvent(80))
      result.current.onPillLayout("USD")(layoutEvent(120))
    })

    expect(result.current.widthStyle).toEqual({ width: 120 })
  })

  it("updates when a wider pill is measured later", () => {
    const { result } = renderHook(() => useEqualPillWidth())

    act(() => {
      result.current.onPillLayout("BTC")(layoutEvent(80))
      result.current.onPillLayout("USD")(layoutEvent(120))
    })

    act(() => {
      result.current.onPillLayout("BTC")(layoutEvent(140))
    })

    expect(result.current.widthStyle).toEqual({ width: 140 })
  })
})
