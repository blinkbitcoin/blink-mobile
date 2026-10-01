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

/**
 * Takes the presentational fields from `preferred` wherever it names the same currency,
 * keeping everything else from `base`.
 *
 * The Breez feed and the backend disagree on wording. Breez carries the raw ISO 4217
 * name column, which is inconsistent — "US Dollar" and "Colombian Peso" are qualified,
 * "Naira" and "Cordoba Oro" are not — while the backend's names are uniformly
 * country-qualified, which is what the picker has always shown. The feed is still the
 * authority on *which* currencies exist and how many decimals they carry, because that
 * is what has to be right when the backend cannot be reached; only the words come from
 * the backend, and only while it is answering.
 *
 * `fractionDigits` deliberately stays with `base`: it is the input the amount was priced
 * with, not a label, and taking it from a different source than the rate would be a way
 * to misprice.
 *
 * Returns `base` unchanged when nothing differs, so a memoised consumer does not
 * re-render for an overlay that said the same thing.
 */
export const withPreferredNames = (
  base: readonly DisplayCurrencyEntry[],
  preferred: readonly DisplayCurrencyEntry[],
): readonly DisplayCurrencyEntry[] => {
  if (base.length === 0 || preferred.length === 0 || base === preferred) return base

  const byCode = new Map(preferred.map((entry) => [entry.id.toUpperCase(), entry]))
  let changed = false

  const merged = base.map((entry) => {
    const named = byCode.get(entry.id.toUpperCase())
    if (
      !named ||
      (named.name === entry.name &&
        named.flag === entry.flag &&
        named.symbol === entry.symbol)
    ) {
      return entry
    }
    changed = true
    return { ...entry, name: named.name, flag: named.flag, symbol: named.symbol }
  })

  return changed ? merged : base
}
