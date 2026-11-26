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
  getBip39Suggestions: (
    prefix: string,
    options?: { minChars?: number; maxResults?: number },
  ) => {
    if (prefix.length < (options?.minChars ?? 3)) return []
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

    expect(result.current.suggestions).toEqual(["abandon"])
  })

  it("keeps the chip for a full word, as the backup confirm screen does", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.updateWord(0, "abandon")
      result.current.setActiveIndex(0)
    })

    expect(result.current.suggestions).toEqual(["abandon"])
  })

  it("suggests nothing before a field is focused", () => {
    const words = ["abandon", ...Array(11).fill("")]
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, initialWords: words }),
    )

    expect(result.current.activeIndex).toBe(-1)
    expect(result.current.suggestions).toEqual([])
  })

  it("suggests nothing for a focused word outside this step", () => {
    const words = [...Array(5).fill(""), "abo", ...Array(6).fill("")]
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, wordsPerStep: 6, step: 2, initialWords: words }),
    )

    act(() => {
      result.current.setActiveIndex(5)
    })

    expect(result.current.suggestions).toEqual([])
  })

  it("selects suggestion and updates word", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

    act(() => {
      result.current.setActiveIndex(0)
    })
    act(() => {
      result.current.selectSuggestion("abandon")
    })

    expect(result.current.words[0]).toBe("abandon")
  })

  it("stepValid is false while a step word is not a backup word", () => {
    const words = ["abandon", "ability", "abl", ...Array(9).fill("")]
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, wordsPerStep: 3, step: 1, initialWords: words }),
    )

    expect(result.current.stepValid).toBe(false)
  })

  it("stepValid is true when every step word is a backup word", () => {
    const words = ["abandon", "ability", "able", ...Array(9).fill("")]
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, wordsPerStep: 3, step: 1, initialWords: words }),
    )

    expect(result.current.stepValid).toBe(true)
  })

  describe("isWordInvalid", () => {
    it("is false for an empty word and for a backup word", () => {
      const words = ["", "abandon", ...Array(10).fill("")]
      const { result } = renderHook(() =>
        useBip39Input({ wordCount: 12, initialWords: words }),
      )

      expect(result.current.isWordInvalid(0)).toBe(false)
      expect(result.current.isWordInvalid(1)).toBe(false)
    })

    it("flags the focused word once no backup word starts with it", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

      act(() => {
        result.current.setActiveIndex(0)
        result.current.updateWord(0, "abz")
      })

      expect(result.current.isWordInvalid(0)).toBe(true)
    })

    it("leaves a focused prefix alone while it can still become a word", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

      act(() => {
        result.current.setActiveIndex(0)
        result.current.updateWord(0, "ab")
      })

      expect(result.current.isWordInvalid(0)).toBe(false)
    })

    it("flags a prefix once the user moves to another field", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

      act(() => {
        result.current.setActiveIndex(0)
        result.current.updateWord(0, "ab")
      })
      act(() => {
        result.current.setActiveIndex(1)
      })

      expect(result.current.isWordInvalid(0)).toBe(true)
    })
  })

  it("allValid is true when every word is a backup word", () => {
    const words = Array(12).fill("abandon")
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, initialWords: words }),
    )

    expect(result.current.allValid).toBe(true)
  })

  /** The phrase check keys off this, so a half-typed last word must not count. */
  it("allValid is false while the last word is only a prefix", () => {
    const words = [...Array(11).fill("abandon"), "ab"]
    const { result } = renderHook(() =>
      useBip39Input({ wordCount: 12, initialWords: words }),
    )

    expect(result.current.allValid).toBe(false)
  })

  it("rejects paste with empty text", () => {
    const { result } = renderHook(() => useBip39Input({ wordCount: 3 }))

    let success = false
    act(() => {
      success = result.current.handlePaste("  ")
    })

    expect(success).toBe(false)
  })

  it("moves focus to the next field when selecting a suggestion mid-step", () => {
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
    expect(result.current.focusRequest).toBe(3)
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
    expect(result.current.focusRequest).toBeNull()
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

  /** Closing the keyboard is how the user leaves a field on Android, so these drive the
   *  listener directly. */
  describe("when the keyboard closes", () => {
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

    it("hides suggestions and deselects", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

      act(() => {
        result.current.setActiveIndex(0)
        result.current.updateWord(0, "abo")
      })
      expect(result.current.suggestions).toEqual(["about", "above"])

      act(() => keyboardListeners.keyboardDidHide())

      expect(result.current.suggestions).toEqual([])
      expect(result.current.activeIndex).toBe(-1)
    })

    it("flags a prefix left in the field", () => {
      const { result } = renderHook(() => useBip39Input({ wordCount: 12 }))

      act(() => {
        result.current.setActiveIndex(0)
        result.current.updateWord(0, "ab")
      })
      expect(result.current.isWordInvalid(0)).toBe(false)

      act(() => keyboardListeners.keyboardDidHide())

      expect(result.current.isWordInvalid(0)).toBe(true)
    })
  })
})
