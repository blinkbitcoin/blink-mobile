import { useCallback, useEffect, useRef, useState } from "react"

import { getBip39Suggestions } from "@app/utils/bip39-wordlist"

type Challenge = { index: number; word: string }

type UseBackupConfirmParams = {
  challenges: readonly Challenge[]
  onComplete: () => void
  disabled?: boolean
}

const AUTO_NAVIGATE_DELAY_MS = 400

export const useBackupConfirm = ({
  challenges,
  onComplete,
  disabled = false,
}: UseBackupConfirmParams) => {
  const [inputs, setInputs] = useState<string[]>(() => challenges.map(() => ""))
  const [activeIndex, setActiveIndex] = useState<number | undefined>()
  const [focusRequest, setFocusRequest] = useState<number | null>(null)
  const hasCompleted = useRef(false)

  const updateInput = (index: number, value: string) => {
    setInputs((prev) => prev.map((current, idx) => (idx === index ? value : current)))
    const normalized = value.trim().toLowerCase()
    const expected = challenges[index].word.toLowerCase()
    if (normalized === expected && index < challenges.length - 1) {
      setFocusRequest(index + 1)
    }
  }

  const selectSuggestion = (index: number, word: string) => {
    updateInput(index, word)
  }

  const clearFocusRequest = useCallback(() => setFocusRequest(null), [])

  const isWordCorrect = (index: number): boolean =>
    inputs[index].trim().toLowerCase() === challenges[index].word.toLowerCase()

  const isWordWrong = (index: number): boolean =>
    inputs[index].trim().length > 0 && !isWordCorrect(index)

  const allCorrect = challenges.every((_, i) => isWordCorrect(i))
  const allFilled = inputs.every((input) => input.trim().length > 0)

  const activeSuggestions =
    activeIndex === undefined
      ? []
      : getBip39Suggestions(inputs[activeIndex], { maxResults: 3 })

  useEffect(() => {
    if (disabled) return undefined
    if (!allCorrect) {
      hasCompleted.current = false
      return undefined
    }
    if (hasCompleted.current) return undefined
    hasCompleted.current = true
    const timer = setTimeout(onComplete, AUTO_NAVIGATE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [allCorrect, disabled, onComplete])

  return {
    inputs,
    activeIndex,
    activeSuggestions,
    allCorrect,
    allFilled,
    updateInput,
    setActiveIndex,
    selectSuggestion,
    isWordCorrect,
    isWordWrong,
    focusRequest,
    clearFocusRequest,
  }
}
