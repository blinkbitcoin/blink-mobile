import { WalletCurrency } from "@app/graphql/generated"

import { resolveAccountKey } from "./account-key"
import { PersistentState } from "./state-migrations"

export type TxLastSeenIds = {
  btcId: string
  usdId: string
}

/** Module-level fallback so consumers can memoize on the object identity. */
const NO_TX_LAST_SEEN: TxLastSeenIds = { btcId: "", usdId: "" }

/**
 * The newest transaction the user has already been shown, per currency, kept on
 * device. Custodial accounts keep this in the Apollo cache, which survives restarts
 * because the cache persistor restores it; a self-custodial account never restores
 * that cache, so without this store its badge would treat the newest transaction as
 * unseen on every launch.
 */
export const getTxLastSeenIds = (state: PersistentState): TxLastSeenIds =>
  state.txLastSeenByAccountId?.[resolveAccountKey(state)] ?? NO_TX_LAST_SEEN

export const withTxLastSeenId = (
  state: PersistentState,
  currency: WalletCurrency,
  id: string,
): PersistentState => {
  if (!id) return state

  const key = resolveAccountKey(state)
  const lastSeen = state.txLastSeenByAccountId?.[key] ?? NO_TX_LAST_SEEN
  const isBtc = currency === WalletCurrency.Btc
  const alreadySeen = isBtc ? lastSeen.btcId === id : lastSeen.usdId === id
  if (alreadySeen) return state

  return {
    ...state,
    txLastSeenByAccountId: {
      ...state.txLastSeenByAccountId,
      [key]: {
        btcId: isBtc ? id : lastSeen.btcId,
        usdId: isBtc ? lastSeen.usdId : id,
      },
    },
  }
}
