import { Keyboard } from "react-native"
import { act, renderHook } from "@testing-library/react-native"

import { useKeyboardVisible } from "@app/hooks/use-keyboard-visible"

const mockIsIos = { current: true }

jest.mock("@app/utils/helper", () => ({
  get isIos() {
    return mockIsIos.current
  },
}))

describe("useKeyboardVisible", () => {
  const listeners: Record<string, () => void> = {}
  const remove = jest.fn()

  beforeEach(() => {
    mockIsIos.current = true
    remove.mockClear()
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(false)
    jest.spyOn(Keyboard, "addListener").mockImplementation((event, listener) => {
      listeners[event] = listener as () => void
      return { remove } as unknown as ReturnType<typeof Keyboard.addListener>
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Object.keys(listeners).forEach((event) => delete listeners[event])
  })

  it("starts from whether the keyboard is already up", () => {
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(true)

    const { result } = renderHook(() => useKeyboardVisible())

    expect(result.current).toBe(true)
  })

  /** iOS warns before the keyboard moves, so layout can move with it. */
  it("follows the keyboard's will events on iOS", () => {
    const { result } = renderHook(() => useKeyboardVisible())

    act(() => listeners.keyboardWillShow())
    expect(result.current).toBe(true)

    act(() => listeners.keyboardWillHide())
    expect(result.current).toBe(false)
    expect(listeners.keyboardDidShow).toBeUndefined()
  })

  /** Android has no will events, only did. */
  it("follows the keyboard's did events on Android", () => {
    mockIsIos.current = false
    const { result } = renderHook(() => useKeyboardVisible())

    act(() => listeners.keyboardDidShow())
    expect(result.current).toBe(true)

    act(() => listeners.keyboardDidHide())
    expect(result.current).toBe(false)
    expect(listeners.keyboardWillShow).toBeUndefined()
  })

  it("stops listening once unmounted", () => {
    const { unmount } = renderHook(() => useKeyboardVisible())

    unmount()

    expect(remove).toHaveBeenCalledTimes(2)
  })
})
