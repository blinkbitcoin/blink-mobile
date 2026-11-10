import { type CurrencyListSource, type DisplayCurrencyEntry } from "@app/types/currency"

/**
 * A {@link CurrencyListSource} over the backend's `currencyList`.
 *
 * The GraphQL `Currency` already carries every field the app renders, so this is a
 * widening rather than a translation — but it goes through the port like the other
 * side, so shared code cannot tell which answered.
 */
export const createCustodialCurrencyList = (
  currencyList: readonly DisplayCurrencyEntry[] | undefined,
  loading: boolean,
): CurrencyListSource => ({
  currencies: currencyList ?? [],
  /** A query that is no longer loading has answered, even if it answered with nothing. */
  hasSettled: !loading,
})
