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

const NO_CURRENCIES: readonly DisplayCurrencyEntry[] = Object.freeze([])

export const noCurrencyListSource: CurrencyListSource = Object.freeze({
  currencies: NO_CURRENCIES,
  hasSettled: true,
})

/**
 * Every currency any of the lists carries, in preference order: where two lists name the
 * same code, the entry of the earlier one is taken whole.
 *
 * Whole, `fractionDigits` included, because the two sources quote prices in different
 * units. The Breez feed prices a whole unit of the currency, so its rate scales to any
 * fraction size; the backend's `realtimePrice` is already in *its own* minor units, so
 * it is right only under the backend's fraction size. Where the two disagree (COP, HUF,
 * LBP and UYU did when this was written), taking the backend's entry keeps both rates
 * right, while taking the feed's mispriced a backend rate a hundredfold. The backend's
 * wording is also the one the picker has always shown: Breez carries the raw ISO 4217
 * name column, so "Naira" where the backend says "Nigerian Naira".
 *
 * A union rather than a choice, because neither list contains the other. The backend
 * carries currencies the feed does not (GHS, TZS, XAF among them), and an account whose
 * display currency is one of those is still priced, by the backend; without its entry
 * the amount was formatted with dollar defaults. The feed carries a few the backend does
 * not, and is all there is while the backend cannot be reached.
 *
 * Returns the first list itself when the others add nothing, so a memoised consumer does
 * not re-render for a merge that changed nothing.
 */
export const mergeCurrencyLists = (
  ...lists: (readonly DisplayCurrencyEntry[])[]
): readonly DisplayCurrencyEntry[] => {
  const populated = lists.filter((list) => list.length > 0)
  const [first, ...rest] = populated
  if (!first) return NO_CURRENCIES

  const seen = new Set(first.map((entry) => entry.id.toUpperCase()))
  const additions = rest.flatMap((list) =>
    list.filter((entry) => {
      const code = entry.id.toUpperCase()
      if (seen.has(code)) return false
      seen.add(code)
      return true
    }),
  )

  return additions.length > 0 ? [...first, ...additions] : first
}
