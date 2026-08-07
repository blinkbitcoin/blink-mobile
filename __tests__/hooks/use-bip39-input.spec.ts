import { Keyboard } from "react-native"

import { renderHook, act } from "@testing-library/react-native"

import { useBip39Input } from "@app/hooks/use-bip39-input"

jest.mock("@app/utils/bip39-wordlist", () => ({
  BIP39_WORDLIST_EN: [
    "abandon",
    "ability",
    "able",
    "about",
    "above",
    "absent",
    "run",
    "runway",
  ],
  getBip39Suggestions: (prefix: string, options?: { maxResults?: number }) => {
    const all = [
      "abandon",
      "ability",
      "able",
      "about",
      "above",
      "absent",
      "run",
      "runway",
    ].filter((w) => w.startsWith(prefix))
    return options?.maxResults ? all.slice(0, options.maxResults) : all
  },
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

  it("requests focus on next index when input is a prefix-unique BIP39 word", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.updateWord(0, "abandon")
    })

    expect(result.current.focusRequest).toBe(1)
  })

  it("does not advance when input is BIP39 word but prefix has multiple matches", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.updateWord(0, "run")
    })

    expect(result.current.focusRequest).toBeNull()
  })

  it("does not advance when input is not a BIP39 word", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.updateWord(0, "ru")
    })

    expect(result.current.focusRequest).toBeNull()
  })

  it("does not advance past last index in step", () => {
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, wordsPerStep: 6, step: 1 }),
    )

    act(() => {
      result.current.updateWord(5, "abandon")
    })

    expect(result.current.focusRequest).toBeNull()
  })

  it("clearFocusRequest resets focusRequest", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.updateWord(0, "abandon")
    })

    expect(result.current.focusRequest).toBe(1)

    act(() => {
      result.current.clearFocusRequest()
    })

    expect(result.current.focusRequest).toBeNull()
  })

  /** Suggestions only render while the keyboard is up, so these drive the keyboard
   *  listeners directly instead of leaving the whole memo untested. */
  describe("with the keyboard visible", () => {
    const keyboardListeners: Record<string, () => void> = {}

    beforeEach(() => {
      jest.spyOn(Keyboard, "addListener").mockImplementation((event, listener) => {
        keyboardListeners[event] = listener as () => void
        return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>
      })
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const showKeyboard = () => act(() => keyboardListeners.keyboardDidShow())

    it("suggests matches for a 3+ character prefix", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))
      showKeyboard()

      act(() => {
        result.current.setActiveIndex(0)
        result.current.updateWord(0, "abo")
      })

      expect(result.current.suggestions).toEqual(["about", "above"])
    })

    it("suggests nothing below the character threshold", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))
      showKeyboard()

      act(() => {
        result.current.setActiveIndex(0)
        result.current.updateWord(0, "ab")
      })

      expect(result.current.suggestions).toEqual([])
    })

    it("suggests nothing for an empty active word", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))
      showKeyboard()

      act(() => {
        result.current.setActiveIndex(0)
      })

      expect(result.current.suggestions).toEqual([])
    })

    it("suggests nothing once the word is complete and unique", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))
      showKeyboard()

      act(() => {
        result.current.setActiveIndex(2)
        result.current.updateWord(2, "runway")
      })

      expect(result.current.suggestions).toEqual([])
    })

    it("keeps suggesting when the typed word is a prefix of other words", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))
      showKeyboard()

      act(() => {
        result.current.setActiveIndex(0)
        result.current.updateWord(0, "run")
      })

      expect(result.current.suggestions).toEqual(["run", "runway"])
    })

    it("hides suggestions and deselects when the keyboard closes", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))
      showKeyboard()

      act(() => {
        result.current.setActiveIndex(0)
        result.current.updateWord(0, "abo")
      })
      expect(result.current.suggestions).toEqual(["about", "above"])

      act(() => keyboardListeners.keyboardDidHide())

      expect(result.current.suggestions).toEqual([])
      expect(result.current.activeIndex).toBe(-1)
    })
  })
})
