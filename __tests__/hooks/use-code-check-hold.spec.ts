import { renderHook } from "@testing-library/react-native"

import { CODE_CHECK_HOLD_MS, useCodeCheckHold } from "@app/hooks/use-code-check-hold"

const mockSetOptions = jest.fn()
const mockUnsubscribe = jest.fn()
type RemoveEvent = { data: { action: { type: string } }; preventDefault: () => void }
let mockBeforeRemove: ((event: RemoveEvent) => void) | undefined
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    setOptions: mockSetOptions,
    addListener: (_event: string, listener: (event: RemoveEvent) => void) => {
      mockBeforeRemove = listener
      return mockUnsubscribe
    },
  }),
}))

/** Whether the hold refuses a removal by that action. */
const isRemovalRefused = (type: string) => {
  const preventDefault = jest.fn()
  mockBeforeRemove?.({ data: { action: { type } }, preventDefault })
  return preventDefault.mock.calls.length > 0
}

describe("useCodeCheckHold", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBeforeRemove = undefined
  })

  it("holds nothing while no code is checked", () => {
    const onHold = jest.fn()
    renderHook(() => useCodeCheckHold(false, { onHold }))

    expect(mockSetOptions).not.toHaveBeenCalled()
    expect(onHold).not.toHaveBeenCalled()
    expect(mockBeforeRemove).toBeUndefined()
  })

  it("refuses the user's ways back while a code is checked, not the app's own resets", () => {
    const onHold = jest.fn()
    renderHook(() => useCodeCheckHold(true, { onHold }))

    expect(mockSetOptions).toHaveBeenCalledWith({ gestureEnabled: false })
    expect(onHold).toHaveBeenCalledTimes(1)
    expect(isRemovalRefused("GO_BACK")).toBe(true)
    expect(isRemovalRefused("POP")).toBe(true)
    expect(isRemovalRefused("RESET")).toBe(false)
  })

  it("lets them go once the check ends", () => {
    const onRelease = jest.fn()
    const { rerender } = renderHook(
      ({ isChecking }: { isChecking: boolean }) =>
        useCodeCheckHold(isChecking, { onRelease }),
      { initialProps: { isChecking: true } },
    )

    rerender({ isChecking: false })

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })
    expect(onRelease).toHaveBeenCalledTimes(1)
  })

  /** A request that never settles must not keep the user on the screen for good. */
  it("lets them go once a check takes too long, and only once", () => {
    jest.useFakeTimers()
    try {
      const onRelease = jest.fn()
      const { unmount } = renderHook(() => useCodeCheckHold(true, { onRelease }))

      jest.advanceTimersByTime(CODE_CHECK_HOLD_MS)
      expect(onRelease).toHaveBeenCalledTimes(1)
      expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })

      unmount()
      expect(onRelease).toHaveBeenCalledTimes(1)
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it("lets them go when the screen goes away", () => {
    const { unmount } = renderHook(() => useCodeCheckHold(true))

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })
  })
})
