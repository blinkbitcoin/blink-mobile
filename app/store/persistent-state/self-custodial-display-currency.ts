import { DefaultAccountId } from "@app/types/wallet"

import { PersistentState } from "./state-migrations"

const resolveActiveSelfCustodialId = (state: PersistentState): string | null => {
  const id = state.activeAccountId
  if (!id || id === DefaultAccountId.Custodial) return null
  return id
}

export const getSelfCustodialDisplayCurrency = (state: PersistentState): string => {
  const id = resolveActiveSelfCustodialId(state)
  if (!id) return "USD"
  return state.selfCustodialDisplayCurrencyByAccountId?.[id] ?? "USD"
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
