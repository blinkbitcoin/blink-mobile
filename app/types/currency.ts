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
