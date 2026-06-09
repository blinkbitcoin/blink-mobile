import { act, renderHook } from "@testing-library/react-hooks"

import { useHasTransitioned } from "@app/hooks/use-has-transitioned"

let transitionEndListener: ((event: { data: { closing: boolean } }) => void) | undefined
const mockUnsubscribe = jest.fn()
const mockAddListener = jest.fn(
  (event: string, listener: (event: { data: { closing: boolean } }) => void) => {
    if (event === "transitionEnd") transitionEndListener = listener
    return mockUnsubscribe
  },
)
const mockNavigation = { addListener: mockAddListener }

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}))

describe("useHasTransitioned", () => {
  beforeEach(() => {
    transitionEndListener = undefined
    mockAddListener.mockClear()
    mockUnsubscribe.mockClear()
  })

  it("starts false before the enter transition finishes", () => {
    const { result } = renderHook(() => useHasTransitioned())

    expect(result.current).toBe(false)
  })

  it("becomes true when the enter transition finishes", () => {
    const { result } = renderHook(() => useHasTransitioned())

    act(() => transitionEndListener?.({ data: { closing: false } }))

    expect(result.current).toBe(true)
  })

  it("stays false on the closing transition", () => {
    const { result } = renderHook(() => useHasTransitioned())

    act(() => transitionEndListener?.({ data: { closing: true } }))

    expect(result.current).toBe(false)
  })

  it("unsubscribes from the listener on unmount", () => {
    const { unmount } = renderHook(() => useHasTransitioned())

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
