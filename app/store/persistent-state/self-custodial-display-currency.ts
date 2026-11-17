import { DefaultAccountId } from "@app/types/wallet"

import { resolveActiveSelfCustodialId } from "./active-self-custodial-account"
import { PersistentState } from "./state-migrations"

/** Undefined when the account has never stored one, so a caller can tell an unanswered
 *  preference from a deliberate "USD" and infer a default only in the first case. */
export const getSelfCustodialDisplayCurrency = (
  state: PersistentState,
): string | undefined => {
  const id = resolveActiveSelfCustodialId(state)
  if (!id) return undefined
  return state.selfCustodialDisplayCurrencyByAccountId?.[id]
}

export const withSelfCustodialDisplayCurrency = (
  state: PersistentState,
  currency: string,
): PersistentState => {
  const id = resolveActiveSelfCustodialId(state)
  if (!id) return state
  return withSelfCustodialDisplayCurrencyForAccount(state, id, currency)
}

/** Writes for an explicit account id so a not-yet-active account (e.g. one provisioned
 *  mid-migration while the custodial account is still active) can be seeded. */
export const withSelfCustodialDisplayCurrencyForAccount = (
  state: PersistentState,
  accountId: string,
  currency: string,
): PersistentState => {
  if (!accountId || accountId === DefaultAccountId.Custodial) return state
  return {
    ...state,
    selfCustodialDisplayCurrencyByAccountId: {
      ...state.selfCustodialDisplayCurrencyByAccountId,
      [accountId]: currency,
    },
  }
}
