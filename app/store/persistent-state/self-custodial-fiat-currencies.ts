import { type DisplayCurrencyEntry } from "@app/types/currency"

import { PersistentState } from "./state-migrations"

/** The persisted shape, beside the code that reads and writes it. */
export type StoredFiatCurrencies = {
  currencies: DisplayCurrencyEntry[]
  /** Unix milliseconds. Kept for symmetry with the rates feed and for debugging; the
   *  list does not go stale the way a price does, so nothing reads it as a deadline. */
  fetchedAt: number
}

/**
 * The currency metadata the SDK last served — code, name, symbol and fraction size.
 *
 * Persisted for the same reason as the rates feed next door: the SDK's cache is in
 * memory and rebuilt empty on every launch, and the Apollo cache is deliberately not
 * restored without an auth token. Without this a self-custodial account cold-starts with
 * no way to spell its own display currency, and every amount renders with the US dollar
 * defaults `useDisplayCurrency` falls back to.
 *
 * Unlike a rate, this does not go stale: a currency's symbol and fraction size do not
 * move, so there is no freshness rule here.
 */

/** ISO 4217 has under 200 active codes; anything past this is a broken feed. */
const MAX_STORED_CURRENCIES = 500

export const getSelfCustodialFiatCurrencies = (
  state: PersistentState,
): StoredFiatCurrencies | undefined => state.selfCustodialFiatCurrencies

export const withSelfCustodialFiatCurrencies = (
  state: PersistentState,
  currencies: StoredFiatCurrencies,
): PersistentState => {
  if (currencies.currencies.length === 0) return state
  return {
    ...state,
    selfCustodialFiatCurrencies: {
      currencies: currencies.currencies.slice(0, MAX_STORED_CURRENCIES),
      fetchedAt: currencies.fetchedAt,
    },
  }
}
