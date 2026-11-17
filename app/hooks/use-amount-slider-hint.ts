import { useCallback } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"

type AmountSliderHintReturn = {
  /** "Slide to select amount" still shows under the slider. */
  showAmountSliderHint: boolean
  /** The sender slid to an amount and the send went through: the hint has done its job. */
  markAmountSliderLearned: () => void
}

export const useAmountSliderHint = (): AmountSliderHintReturn => {
  const { persistentState, updateState } = usePersistentStateContext()

  const markAmountSliderLearned = useCallback(() => {
    updateState((prev) => prev && { ...prev, hasLearnedAmountSlider: true })
  }, [updateState])

  return {
    showAmountSliderHint: !persistentState.hasLearnedAmountSlider,
    markAmountSliderLearned,
  }
}
