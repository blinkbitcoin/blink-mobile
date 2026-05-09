import { renderHook, act } from "@testing-library/react-native"

import { useBackupConfirm } from "@app/screens/spark-onboarding/hooks/use-backup-confirm"

jest.mock("@app/utils/bip39-wordlist", () => ({
  getBip39Suggestions: (prefix: string) => {
    const words = ["youth", "young", "bundle", "burden", "harvest", "harbor"]
    if (prefix.length < 3) return []
    return words.filter((w) => w.startsWith(prefix.toLowerCase())).slice(0, 3)
  },
}))

const challenges = [
  { index: 0, word: "youth" },
  { index: 4, word: "bundle" },
  { index: 8, word: "harvest" },
] as const

describe("useBackupConfirm", () => {
  const mockOnComplete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("starts with empty inputs and no active index", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    expect(result.current.inputs).toEqual(["", "", ""])
    expect(result.current.activeIndex).toBeUndefined()
    expect(result.current.allCorrect).toBe(false)
    expect(result.current.allFilled).toBe(false)
  })

  it("updates input at specific index", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.updateInput(0, "you"))

    expect(result.current.inputs[0]).toBe("you")
    expect(result.current.inputs[1]).toBe("")
  })

  it("fills input when suggestion is selected", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.setActiveIndex(0))
    act(() => result.current.selectSuggestion(0, "youth"))

    expect(result.current.inputs[0]).toBe("youth")
  })

  it("detects correct word", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.selectSuggestion(0, "youth"))

    expect(result.current.isWordCorrect(0)).toBe(true)
    expect(result.current.isWordWrong(0)).toBe(false)
  })

  it("detects wrong word", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.updateInput(0, "young"))

    expect(result.current.isWordCorrect(0)).toBe(false)
    expect(result.current.isWordWrong(0)).toBe(true)
  })

  it("returns suggestions for active input", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => {
      result.current.updateInput(0, "you")
      result.current.setActiveIndex(0)
    })

    expect(result.current.activeSuggestions).toContain("youth")
    expect(result.current.activeSuggestions).toContain("young")
  })

  it("calls onComplete when all words are correct", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.selectSuggestion(0, "youth"))
    act(() => result.current.selectSuggestion(1, "bundle"))
    act(() => result.current.selectSuggestion(2, "harvest"))

    act(() => jest.advanceTimersByTime(500))

    expect(mockOnComplete).toHaveBeenCalled()
  })

  it("does not call onComplete when words are wrong", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.updateInput(0, "wrong"))
    act(() => result.current.updateInput(1, "wrong"))
    act(() => result.current.updateInput(2, "wrong"))

    act(() => jest.advanceTimersByTime(500))

    expect(mockOnComplete).not.toHaveBeenCalled()
  })

  it("requests focus on next index when correct word is typed", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.updateInput(0, "youth"))

    expect(result.current.focusRequest).toBe(1)
  })

  it("does not request focus past the last challenge", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.updateInput(2, "harvest"))

    expect(result.current.focusRequest).toBeNull()
  })

  it("does not request focus when typed word is wrong", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.updateInput(0, "young"))

    expect(result.current.focusRequest).toBeNull()
  })

  it("clearFocusRequest resets focusRequest", () => {
    const { result } = renderHook(() =>
      useBackupConfirm({ challenges, onComplete: mockOnComplete }),
    )

    act(() => result.current.updateInput(0, "youth"))
    expect(result.current.focusRequest).toBe(1)

    act(() => result.current.clearFocusRequest())

    expect(result.current.focusRequest).toBeNull()
  })

  it("does not auto-complete while disabled, then fires once unlocked (Critical #1)", () => {
    const { result, rerender } = renderHook(
      ({ disabled }: { disabled: boolean }) =>
        useBackupConfirm({ challenges, onComplete: mockOnComplete, disabled }),
      { initialProps: { disabled: true } },
    )

    act(() => result.current.selectSuggestion(0, "youth"))
    act(() => result.current.selectSuggestion(1, "bundle"))
    act(() => result.current.selectSuggestion(2, "harvest"))

    act(() => jest.advanceTimersByTime(500))
    expect(mockOnComplete).not.toHaveBeenCalled()

    rerender({ disabled: false })
    act(() => jest.advanceTimersByTime(500))

    expect(mockOnComplete).toHaveBeenCalledTimes(1)
  })
})
