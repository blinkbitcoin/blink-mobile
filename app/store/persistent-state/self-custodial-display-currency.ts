import { resolveActiveSelfCustodialId } from "./active-self-custodial-account"
import { PersistentState } from "./state-migrations"

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
  return {
    ...state,
    selfCustodialDisplayCurrencyByAccountId: {
      ...state.selfCustodialDisplayCurrencyByAccountId,
      [id]: currency,
    },
  }
}
