/**
 * A currency as the app names and formats one, independent of who supplies the list.
 *
 * The same fields the backend's GraphQL `Currency` carries, declared here rather than
 * imported from the generated schema so the Breez feed can produce them too — and so a
 * screen both account types reach does not depend on either adapter.
 */
export type DisplayCurrencyEntry = {
  id: string
  flag: string
  name: string
  symbol: string
  fractionDigits: number
}

/**
 * A place the currency list can come from — the port both account types implement.
 * The Breez feed for a self-custodial account, the backend's `currencyList` otherwise.
 */
export type CurrencyListSource = {
  currencies: readonly DisplayCurrencyEntry[]
  /** Whether this source has finished trying. An empty list that has settled means the
   *  picker should say so rather than spin. */
  hasSettled: boolean
}

export const noCurrencyListSource: CurrencyListSource = Object.freeze({
  currencies: Object.freeze([]),
  hasSettled: true,
})

/** The first source with a list, or the last one when none has yet. */
export const firstPopulatedCurrencyList = (
  ...sources: CurrencyListSource[]
): CurrencyListSource =>
  sources.find((source) => source.currencies.length > 0) ??
  sources[sources.length - 1] ??
  noCurrencyListSource
