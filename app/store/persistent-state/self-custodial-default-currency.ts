import { resolveActiveSelfCustodialId } from "./active-self-custodial-account"
import { PersistentState } from "./state-migrations"

type SelfCustodialDefaultCurrency = "BTC" | "USD"

export const getSelfCustodialDefaultCurrency = (
  state: PersistentState,
): SelfCustodialDefaultCurrency => {
  const id = resolveActiveSelfCustodialId(state)
  if (!id) return "BTC"
  return state.selfCustodialDefaultWalletCurrencyByAccountId?.[id] ?? "BTC"
}

export const withSelfCustodialDefaultCurrency = (
  state: PersistentState,
  currency: SelfCustodialDefaultCurrency,
): PersistentState => {
  const id = resolveActiveSelfCustodialId(state)
  if (!id) return state
  return {
    ...state,
    selfCustodialDefaultWalletCurrencyByAccountId: {
      ...state.selfCustodialDefaultWalletCurrencyByAccountId,
      [id]: currency,
    },
  }
}
