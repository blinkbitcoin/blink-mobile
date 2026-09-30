import { type FiatRate } from "@app/types/price"

import { PersistentState } from "./state-migrations"

/** The persisted shape. It lives with the code that reads and writes it rather than
 *  with the domain types, because the timestamp is a property of this device's copy. */
export type StoredFiatRates = {
  rates: FiatRate[]
  /** Unix milliseconds, from the device clock at the moment the feed was read. */
  fetchedAt: number
}

/**
 * The last fiat feed the SDK served, kept so a cold start with no connectivity can still
 * price a balance.
 *
 * Not per account: an exchange rate is a property of the world, not of a wallet, and a
 * second account on the device gains nothing by fetching it again.
 *
 * It lives here rather than in the Apollo cache because that cache is only restored when
 * an auth token is present (`client.tsx`), deliberately, so a persisted custodial cache
 * cannot leak into a self-custodial session. A self-custodial-only user therefore starts
 * every launch with an empty cache and would have no price at all.
 */

/** Guards against a feed large enough to slow the persistent-state write, which happens
 *  on every state change. The SDK serves on the order of 100 currencies. */
const MAX_STORED_RATES = 500

export const getSelfCustodialFiatRates = (
  state: PersistentState,
): StoredFiatRates | undefined => state.selfCustodialFiatRates

export const withSelfCustodialFiatRates = (
  state: PersistentState,
  rates: StoredFiatRates,
): PersistentState => {
  if (rates.rates.length === 0) return state
  return {
    ...state,
    selfCustodialFiatRates: {
      rates: rates.rates.slice(0, MAX_STORED_RATES),
      fetchedAt: rates.fetchedAt,
    },
  }
}
