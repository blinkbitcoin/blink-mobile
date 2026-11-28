import { useCallback, useEffect, useState } from "react"
import { Keyboard } from "react-native"

import {
  BIP39_WORDLIST_EN,
  getBip39Suggestions,
  splitWords,
} from "@app/utils/bip39-wordlist"

/** Built on first use instead of at module evaluation: with inline requires this module
 *  evaluates at the phrase screen's first render, and eagerly materializing the 2048-word
 *  Set there put wordlist work (and any failure) on the render path (#4070). */
let bip39WordSet: Set<string> | undefined
const getBip39WordSet = (): Set<string> => {
  bip39WordSet ??= new Set(BIP39_WORDLIST_EN)
  return bip39WordSet
}

const MAX_SUGGESTIONS = 3

const isBip39Word = (word: string): boolean => getBip39WordSet().has(word)

/** Whether some backup word still starts with `text`, so typing on can make it valid. */
const isBip39Prefix = (text: string): boolean =>
  BIP39_WORDLIST_EN.some((word) => word.startsWith(text))

type UseBip39InputParams = {
  wordCount: number
  wordsPerStep?: number
  step?: number
  initialWords?: string[]
}

export const useBip39Input = ({
  wordCount,
  wordsPerStep = wordCount,
  step = 1,
  initialWords,
}: UseBip39InputParams) => {
  const offset = (step - 1) * wordsPerStep

  const [words, setWords] = useState<string[]>(initialWords ?? Array(wordCount).fill(""))
  const [activeIndex, setActiveIndex] = useState(-1)
  const [focusRequest, setFocusRequest] = useState<number | null>(null)

  /** Closing the keyboard leaves the field focused on Android, so no blur fires; this is
   *  what marks the user as done with it, for the suggestions and the prefix check. */
  useEffect(() => {
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setActiveIndex(-1))
    return () => hideSub.remove()
  }, [])

  const updateWord = useCallback(
    (index: number, value: string) => {
      const normalized = value.toLowerCase().trim()
      setWords((prev) => {
        const next = [...prev]
        next[index] = normalized
        return next
      })
      const lastIndexInStep = offset + wordsPerStep - 1
      if (!isBip39Word(normalized)) return
      if (index >= lastIndexInStep) return
      const matches = BIP39_WORDLIST_EN.filter((w) => w.startsWith(normalized))
      if (matches.length !== 1) return
      setFocusRequest(index + 1)
    },
    [offset, wordsPerStep],
  )

  const clearFocusRequest = useCallback(() => setFocusRequest(null), [])

  const handlePaste = useCallback(
    (text: string) => {
      const parsed = splitWords(text)
      if (parsed.length !== wordCount) return false
      setWords(parsed)
      setActiveIndex(-1)
      return true
    },
    [wordCount],
  )

  /** Same rule as the backup confirm screen: up to three matches for the focused word.
   *  Only within this step: "Next" can be tapped with the keyboard up, and a word from
   *  step 1 must not take suggestions (and picks) on step 2. */
  const activeInStep = activeIndex >= offset && activeIndex < offset + wordsPerStep
  const suggestions = activeInStep
    ? getBip39Suggestions(words[activeIndex], { maxResults: MAX_SUGGESTIONS })
    : []

  /** A picked word is always a backup word, so focus moves on like a fully typed one. */
  const selectSuggestion = useCallback(
    (word: string) => {
      updateWord(activeIndex, word)
      if (activeIndex < offset + wordsPerStep - 1) setFocusRequest(activeIndex + 1)
    },
    [activeIndex, updateWord, offset, wordsPerStep],
  )

  /** Flagged as soon as no backup word starts with it; a bare prefix only once the user
   *  has left the field, so "hel" on its way to "hello" stays neutral while typed. */
  const isWordInvalid = useCallback(
    (index: number): boolean => {
      const word = words[index]
      if (!word || isBip39Word(word)) return false
      return index !== activeIndex || !isBip39Prefix(word)
    },
    [words, activeIndex],
  )

  const stepWords = words.slice(offset, offset + wordsPerStep)
  const stepValid = stepWords.every(isBip39Word)
  const allValid = words.every(isBip39Word)

  return {
    words,
    stepWords,
    offset,
    activeIndex,
    setActiveIndex,
    updateWord,
    handlePaste,
    suggestions,
    selectSuggestion,
    isWordInvalid,
    stepValid,
    allValid,
    focusRequest,
    clearFocusRequest,
  }
}
