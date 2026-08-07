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
): PersistentState =>
  withThemePreferenceForAccount(state, resolveAccountKey(state), theme)

/** Writes for an explicit account key so a not-yet-active account (e.g. one provisioned
 *  mid-migration) can be seeded. Unlike the self-custodial maps, the custodial sentinel
 *  is a legitimate key here — resolveAccountKey produces it for the custodial account. */
export const withThemePreferenceForAccount = (
  state: PersistentState,
  accountKey: string,
  theme: ThemePreference,
): PersistentState => {
  if (!accountKey) return state
  return {
    ...state,
    themeByAccountId: {
      ...state.themeByAccountId,
      [accountKey]: theme,
    },
  }
}
