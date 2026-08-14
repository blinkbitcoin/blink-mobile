import { DefaultAccountId } from "@app/types/wallet"

import { withSelfCustodialDisplayCurrencyForAccount } from "./self-custodial-display-currency"
import { withSelfCustodialLanguageForAccount } from "./self-custodial-language"
import { PersistentState } from "./state-migrations"
import { withThemePreferenceForAccount } from "./theme-preference"

/** null = value unknown at seeding time (cold cache/offline): skip it so the
 *  account keeps today's fallback instead of freezing a wrong guess. */
export type CustodialSettingsSnapshot = {
  displayCurrency: string | null
  language: string | null
}

/** Copies the custodial account's settings onto a freshly provisioned self-custodial
 *  account so migration preserves them. Known server values are seeded even when they
 *  equal the local fallback ("USD"/"DEFAULT" are real choices, and the write is
 *  idempotent); the theme is copied from the custodial slot of the local theme map. */
export const seedMigratedAccountSettings = (
  state: PersistentState,
  accountId: string,
  snapshot: CustodialSettingsSnapshot,
): PersistentState => {
  let next = state
  if (snapshot.displayCurrency) {
    next = withSelfCustodialDisplayCurrencyForAccount(
      next,
      accountId,
      snapshot.displayCurrency,
    )
  }
  if (snapshot.language) {
    next = withSelfCustodialLanguageForAccount(next, accountId, snapshot.language)
  }
  const custodialTheme = state.themeByAccountId?.[DefaultAccountId.Custodial]
  if (custodialTheme && accountId && accountId !== DefaultAccountId.Custodial) {
    next = withThemePreferenceForAccount(next, accountId, custodialTheme)
  }
  return next
}
