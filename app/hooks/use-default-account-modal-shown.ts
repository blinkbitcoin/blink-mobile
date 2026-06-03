import { useCallback } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getDefaultAccountModalShown,
  markDefaultAccountModalShown,
} from "@app/store/persistent-state/default-account-modal-shown"

type UseDefaultAccountModalShownReturn = {
  defaultAccountModalShown: boolean
  markDefaultAccountModalShown: () => void
}

export const useDefaultAccountModalShown = (): UseDefaultAccountModalShownReturn => {
  const { persistentState, updateState } = usePersistentStateContext()

  const markShown = useCallback(() => {
    updateState((prev) => prev && markDefaultAccountModalShown(prev))
  }, [updateState])

  return {
    defaultAccountModalShown: getDefaultAccountModalShown(persistentState),
    markDefaultAccountModalShown: markShown,
  }
}
