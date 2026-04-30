import { DefaultAccountId } from "@app/types/wallet.types"

import { PersistentState } from "./state-migrations"

type SelfCustodialDefaultCurrency = "BTC" | "USD"

const resolveActiveSelfCustodialId = (state: PersistentState): string | null => {
  const id = state.activeAccountId
  if (!id || id === DefaultAccountId.Custodial) return null
  return id
}

export const getSelfCustodialDefaultCurrency = (
  state: PersistentState,
): SelfCustodialDefaultCurrency => {
  const id = resolveActiveSelfCustodialId(state)
  const fromMap = id
    ? state.selfCustodialDefaultWalletCurrencyByAccountId?.[id]
    : undefined
  return fromMap ?? state.selfCustodialDefaultWalletCurrency ?? "BTC"
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
