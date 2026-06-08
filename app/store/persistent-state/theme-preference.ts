import { resolveAccountKey } from "./account-key"
import { PersistentState } from "./state-migrations"

export type ThemePreference = "system" | "light" | "dark"

export const getThemePreference = (state: PersistentState): ThemePreference => {
  const key = resolveAccountKey(state)
  return state.themeByAccountId?.[key] ?? "system"
}

export const withThemePreference = (
  state: PersistentState,
  theme: ThemePreference,
): PersistentState => {
  const key = resolveAccountKey(state)
  return {
    ...state,
    themeByAccountId: {
      ...state.themeByAccountId,
      [key]: theme,
    },
  }
}
