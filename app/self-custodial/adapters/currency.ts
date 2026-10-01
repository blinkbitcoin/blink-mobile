import { type CurrencyListSource, type DisplayCurrencyEntry } from "@app/types/currency"

/**
 * A {@link CurrencyListSource} over the currency metadata the Breez SDK served, already
 * mapped by `price/currency-mapping.ts` and persisted by the fiat provider.
 *
 * Thin by design: the translation happens once, where the SDK's shape is known, and
 * this only presents it as the port.
 */
export const createSelfCustodialCurrencyList = (
  currencies: readonly DisplayCurrencyEntry[],
  hasSettled: boolean,
): CurrencyListSource => ({ currencies, hasSettled })
