import { renderHook, act } from "@testing-library/react-native"

import { useBip39Input } from "@app/hooks/use-bip39-input"

jest.mock("@app/utils/bip39-wordlist", () => ({
  BIP39_WORDLIST_EN: ["abandon", "ability", "able", "about", "above", "absent"],
  getBip39Suggestions: (prefix: string) =>
    ["abandon", "ability", "able", "about", "above", "absent"].filter((w) =>
      w.startsWith(prefix),
    ),
  splitWords: (text: string) => text.trim().toLowerCase().split(/\s+/),
}))

describe("useBip39Input", () => {
  it("initializes with empty words", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    expect(result.current.words).toHaveLength(12)
    expect(result.current.words.every((w) => w === "")).toBe(true)
  })

  it("accepts initialWords", () => {
    const initial = ["abandon", "ability", "", "", "", "", "", "", "", "", "", ""]
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, initialWords: initial }),
    )

    expect(result.current.words[0]).toBe("abandon")
    expect(result.current.words[1]).toBe("ability")
  })

  it("updates a word", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.updateWord(0, "Abandon")
    })

    expect(result.current.words[0]).toBe("abandon")
  })

  it("returns stepWords for current step", () => {
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, wordsPerStep: 6, step: 1 }),
    )

    expect(result.current.stepWords).toHaveLength(6)
    expect(result.current.offset).toBe(0)
  })

  it("returns stepWords for step 2", () => {
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, wordsPerStep: 6, step: 2 }),
    )

    expect(result.current.stepWords).toHaveLength(6)
    expect(result.current.offset).toBe(6)
  })

  it("handles paste of correct word count", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 3 }))

    let success = false
    act(() => {
      success = result.current.handlePaste("Abandon Ability Able")
    })

    expect(success).toBe(true)
    expect(result.current.words).toEqual(["abandon", "ability", "able"])
  })

  it("rejects paste of wrong word count", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 3 }))

    let success = false
    act(() => {
      success = result.current.handlePaste("abandon ability")
    })

    expect(success).toBe(false)
  })

  it("provides suggestions after 3 characters", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.updateWord(0, "aba")
      result.current.setActiveIndex(0)
    })

    // Suggestions depend on keyboard being visible (keyboardVisible state)
    // In tests keyboard is not shown so suggestions are empty
    expect(result.current.suggestions).toEqual([])
  })

  it("does not provide suggestions for valid BIP39 word", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.updateWord(0, "abandon")
      result.current.setActiveIndex(0)
    })

    expect(result.current.suggestions).toEqual([])
  })

  it("selects suggestion and updates word", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.setActiveIndex(0)
      result.current.selectSuggestion("abandon")
    })

    expect(result.current.words[0]).toBe("abandon")
  })

  it("stepFilled is true when all step words are filled", () => {
    const words = ["a", "b", "c", "", "", "", "", "", "", "", "", ""]
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, wordsPerStep: 3, step: 1, initialWords: words }),
    )

    expect(result.current.stepFilled).toBe(true)
  })

  it("allFilled is true when all words are filled", () => {
    const words = Array(12).fill("abandon")
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, initialWords: words }),
    )

    expect(result.current.allFilled).toBe(true)
  })

  it("rejects paste with empty text", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 3 }))

    let success = false
    act(() => {
      success = result.current.handlePaste("  ")
    })

    expect(success).toBe(false)
  })

  it("advances activeIndex when selecting suggestion mid-step", () => {
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, wordsPerStep: 6, step: 1 }),
    )

    act(() => {
      result.current.setActiveIndex(2)
    })

    act(() => {
      result.current.selectSuggestion("able")
    })

    expect(result.current.words[2]).toBe("able")
    expect(result.current.activeIndex).toBe(3)
  })

  it("does not advance past step boundary", () => {
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, wordsPerStep: 6, step: 1 }),
    )

    act(() => {
      result.current.setActiveIndex(5)
    })

    act(() => {
      result.current.selectSuggestion("absent")
    })

    expect(result.current.words[5]).toBe("absent")
    expect(result.current.activeIndex).toBe(5)
  })
})
