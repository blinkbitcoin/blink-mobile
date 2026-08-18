import { useCallback } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getAlwaysHideBalance,
  withAlwaysHideBalance,
} from "@app/store/persistent-state/hide-balance"

type HideBalanceSettingReturn = {
  alwaysHideBalance: boolean
  setAlwaysHideBalance: (alwaysHideBalance: boolean) => void
}

/**
 * The "Always hide balance" setting from the Security screen. Deliberately does not
 * carry the legacy Apollo adoption: this hook is mounted in two places at once, so the
 * one-shot adoption lives in HideAmountContainer where it can only run once.
 */
export const useHideBalanceSetting = (): HideBalanceSettingReturn => {
  const { persistentState, updateState } = usePersistentStateContext()

  const setAlwaysHideBalance = useCallback(
    (alwaysHideBalance: boolean) => {
      updateState((prev) => prev && withAlwaysHideBalance(prev, alwaysHideBalance))
    },
    [updateState],
  )

  return {
    alwaysHideBalance: getAlwaysHideBalance(persistentState),
    setAlwaysHideBalance,
  }
}
