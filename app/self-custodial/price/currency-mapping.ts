import { type FiatCurrency } from "@breeztech/breez-sdk-spark-react-native"

import { type DisplayCurrencyEntry } from "@app/types/currency"

/**
 * Translates the Breez SDK's currency metadata into the app's own shape, so a
 * self-custodial account can name and format its display currency without the Blink
 * backend.
 *
 * Only the translation lives here; {@link DisplayCurrencyEntry} itself is in
 * `app/types/currency.ts`, because the settings screen that renders it is shared with
 * custodial users and must not depend on this module.
 *
 * Pure: no SDK call, no storage, no React.
 */

const REGIONAL_INDICATOR_A = 0x1f1e6
const LATIN_A = "A".charCodeAt(0)

/**
 * ISO 4217 codes are the ISO 3166 country code plus a letter for the unit, so the first
 * two characters are the flag. Verified against the backend's own `currencyList`, which
 * answers `USD → 🇺🇸`, `EUR → 🇪🇺`, `PKR → 🇵🇰`.
 *
 * The X-codes are the exception: they are supranational (`XAF`, `XOF`, `XCD`, `XPF`) or
 * not a currency at all (`XDR`, `XAU`, `XTS`), and `X` is not a country. They get no
 * flag rather than a wrong one — the row still reads correctly without it, while
 * 🇽🇦 next to the Central African franc would be a fabrication.
 */
export const flagForCurrencyCode = (code: string): string => {
  const upper = code.toUpperCase()
  if (upper.length < 2 || upper.startsWith("X")) return ""
  const [first, second] = [upper.charCodeAt(0), upper.charCodeAt(1)]
  if (!isLatinLetter(first) || !isLatinLetter(second)) return ""
  return (
    String.fromCodePoint(REGIONAL_INDICATOR_A + (first - LATIN_A)) +
    String.fromCodePoint(REGIONAL_INDICATOR_A + (second - LATIN_A))
  )
}

const isLatinLetter = (charCode: number): boolean =>
  charCode >= LATIN_A && charCode <= LATIN_A + 25

/**
 * A currency with no name is unusable in the picker and unsafe to format against, so it
 * is dropped rather than shown as a blank row. Its symbol may legitimately be absent —
 * the code itself is then the symbol, which is what the backend does for codes with no
 * glyph.
 */
export const toDisplayCurrencyEntry = (
  currency: FiatCurrency,
): DisplayCurrencyEntry | undefined => {
  const id = currency.id?.toUpperCase()
  const name = currency.info?.name
  if (!id || !name) return undefined

  const fractionDigits = currency.info.fractionSize
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0) return undefined

  return {
    id,
    flag: flagForCurrencyCode(id),
    name,
    symbol: currency.info.symbol?.grapheme ?? currency.info.uniqSymbol?.grapheme ?? id,
    fractionDigits,
  }
}

/** Sorted by name, matching the order the picker shows the backend's list in. */
export const toDisplayCurrencyList = (
  currencies: readonly FiatCurrency[],
): DisplayCurrencyEntry[] =>
  currencies
    .map(toDisplayCurrencyEntry)
    .filter((entry): entry is DisplayCurrencyEntry => entry !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))
