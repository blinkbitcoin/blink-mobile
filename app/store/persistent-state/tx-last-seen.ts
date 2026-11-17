import { WalletCurrency } from "@app/graphql/generated"

import { resolveAccountKey } from "./account-key"
import { PersistentState } from "./state-migrations"

export type TxLastSeenIds = {
  btcId: string
  usdId: string
  /** When this record was started (ms). Only transactions newer than this are announced:
   *  a restored wallet replays its whole history as it syncs, and none of that is new.
   *  Absent on records written before it existed, which announce as before. */
  announceSinceMs?: number
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

/** Whether the active account has a record yet. A self-custodial account gets none until
 *  `withTxSeenBaseline` starts one, and announces nothing until then. */
export const hasTxLastSeenRecord = (state: PersistentState): boolean =>
  Boolean(state.txLastSeenByAccountId?.[resolveAccountKey(state)])

/** Starts the active account's record at `nowMs`, so everything already in its history,
 *  including what a restore is still replaying, counts as seen. A no-op once it exists. */
export const withTxSeenBaseline = (
  state: PersistentState,
  nowMs: number,
): PersistentState => {
  if (hasTxLastSeenRecord(state)) return state

  return {
    ...state,
    txLastSeenByAccountId: {
      ...state.txLastSeenByAccountId,
      [resolveAccountKey(state)]: { btcId: "", usdId: "", announceSinceMs: nowMs },
    },
  }
}

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
        ...lastSeen,
        btcId: isBtc ? id : lastSeen.btcId,
        usdId: isBtc ? lastSeen.usdId : id,
      },
    },
  }
}
