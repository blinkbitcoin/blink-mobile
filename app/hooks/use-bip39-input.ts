import { useCallback, useEffect, useMemo, useState } from "react"
import { Keyboard } from "react-native"

import {
  BIP39_WORDLIST_EN,
  getBip39Suggestions,
  splitWords,
} from "@app/utils/bip39-wordlist"

const BIP39_WORD_SET = new Set(BIP39_WORDLIST_EN)

const MIN_CHARS = 3
const MAX_SUGGESTIONS = 3

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
  const [activeIndex, setActiveIndex] = useState(offset)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [focusRequest, setFocusRequest] = useState<number | null>(null)

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    )
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false)
      setActiveIndex(-1)
    })
    return () => {
      showSub.remove()
      hideSub.remove()
    }
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
      if (!BIP39_WORD_SET.has(normalized)) return
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

  const suggestions = useMemo(() => {
    if (!keyboardVisible) return []
    const current = words[activeIndex]
    if (!current || current.length < MIN_CHARS) return []
    const matches = getBip39Suggestions(current, { maxResults: MAX_SUGGESTIONS })
    if (matches.length === 1 && matches[0] === current) return []
    return matches
  }, [words, activeIndex, keyboardVisible])

  const selectSuggestion = useCallback(
    (word: string) => {
      updateWord(activeIndex, word)
      const maxForStep = offset + wordsPerStep - 1
      if (activeIndex < maxForStep) {
        setActiveIndex(activeIndex + 1)
      }
    },
    [activeIndex, updateWord, offset, wordsPerStep],
  )

  const stepWords = words.slice(offset, offset + wordsPerStep)
  const stepFilled = stepWords.every((w) => w.length > 0)
  const allFilled = words.every((w) => w.length > 0)

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
    stepFilled,
    allFilled,
    focusRequest,
    clearFocusRequest,
  }
}
