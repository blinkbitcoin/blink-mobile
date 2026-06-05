import { useCallback } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getDefaultAccountModalShown,
  withDefaultAccountModalShown,
} from "@app/store/persistent-state/default-account-modal-shown"

type DefaultAccountModalShownReturn = {
  defaultAccountModalShown: boolean
  markDefaultAccountModalShown: () => void
}

export const useDefaultAccountModalShown = (): DefaultAccountModalShownReturn => {
  const { persistentState, updateState } = usePersistentStateContext()

  const markShown = useCallback(() => {
    updateState((prev) => prev && withDefaultAccountModalShown(prev))
  }, [updateState])

  return {
    defaultAccountModalShown: getDefaultAccountModalShown(persistentState),
    markDefaultAccountModalShown: markShown,
  }
}
