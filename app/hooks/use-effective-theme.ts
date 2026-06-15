import { useCallback } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getThemePreference,
  type ThemePreference,
  withThemePreference,
} from "@app/store/persistent-state/theme-preference"

type EffectiveThemeReturn = {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

export const useEffectiveTheme = (): EffectiveThemeReturn => {
  const { persistentState, updateState } = usePersistentStateContext()

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      updateState((prev) => prev && withThemePreference(prev, theme))
    },
    [updateState],
  )

  return {
    theme: getThemePreference(persistentState),
    setTheme,
  }
}
