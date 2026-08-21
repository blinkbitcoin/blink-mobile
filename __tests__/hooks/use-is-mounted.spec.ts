import { renderHook } from "@testing-library/react-native"

import { useIsMounted } from "@app/hooks/use-is-mounted"

describe("useIsMounted", () => {
  it("answers true while the component is on screen", () => {
    const { result } = renderHook(() => useIsMounted())

    expect(result.current()).toBe(true)
  })

  it("answers false once the component is gone", () => {
    const { result, unmount } = renderHook(() => useIsMounted())
    const isMounted = result.current

    unmount()

    // The handler that captured it keeps answering after the screen was left.
    expect(isMounted()).toBe(false)
  })

  it("keeps the same function across renders, so a handler cannot capture a stale one", () => {
    const { result, rerender } = renderHook(() => useIsMounted())
    const first = result.current

    rerender({})

    expect(result.current).toBe(first)
  })
})
