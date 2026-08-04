/**
 * Run a spec as if the device were set to a given locale.
 *
 * `formatNumberPadNumber` formats the number pad's major amount with a bare
 * `Number#toLocaleString()` on purpose: the amount being typed is grouped the
 * way the user's own device groups digits. Which locale that resolves to is
 * decided by the runtime — `LANG`/`LC_ALL` under jest, the first locale data
 * `app/i18n/mapping.ts` hands the formatjs polyfill on device — so a spec that
 * hardcodes "1,500" is really asserting the locale of whichever machine happens
 * to run it, and goes red for a developer whose shell is set to, say, en_ZA
 * (which groups with a no-break space).
 *
 * `withDeviceLocale` substitutes that default, so a spec states the locale it
 * means instead of inheriting one, and can run the same code under several:
 *
 *   describe("...", () => {
 *     withDeviceLocale("de-DE")
 *     it("groups the way the device does", () => { ... })
 *   })
 *
 * Only the default is substituted. A call that names its locale is passed
 * through untouched, which is what lets a spec tell the number pad's
 * device-locale output apart from the "en-US" that `formatCurrencyHelper`
 * (@app/hooks/use-display-currency) pins for every converted amount.
 *
 * Numbers only: dates still follow the runtime default. Add the matching
 * `Date`/`Intl.DateTimeFormat` wrappers here if a date spec ever needs the
 * same treatment.
 */

/**
 * Derived from whatever lib the TS config resolves rather than written out, so
 * this keeps compiling when the `Intl.LocalesArgument` typings move again.
 */
type LocalesArgument = Parameters<typeof Number.prototype.toLocaleString>[0]

const installDeviceLocale = (locale: string): (() => void) => {
  const originalToLocaleString = Number.prototype.toLocaleString
  const OriginalNumberFormat = Intl.NumberFormat

  const orDeviceLocale = (locales: LocalesArgument): LocalesArgument =>
    locales === undefined ? locale : locales

  /**
   * Proxies rather than wrapper functions: the receiver a number method is
   * called on, and NumberFormat's prototype, statics (supportedLocalesOf) and
   * `instanceof`, all keep working through them untouched.
   */
  const patchedToLocaleString = new Proxy(originalToLocaleString, {
    apply: (target, value, [locales, options]) =>
      Reflect.apply(target, value, [orDeviceLocale(locales), options]),
  })

  const PatchedNumberFormat = new Proxy(OriginalNumberFormat, {
    construct: (target, [locales, options], newTarget) =>
      Reflect.construct(target, [orDeviceLocale(locales), options], newTarget),
    apply: (target, _thisArg, [locales, options]) =>
      target(orDeviceLocale(locales), options),
  })

  // eslint-disable-next-line no-extend-native
  Number.prototype.toLocaleString = patchedToLocaleString
  Intl.NumberFormat = PatchedNumberFormat

  return () => {
    // eslint-disable-next-line no-extend-native
    Number.prototype.toLocaleString = originalToLocaleString
    Intl.NumberFormat = OriginalNumberFormat
  }
}

/**
 * Pin the default locale for the enclosing `describe` (or the whole file, when
 * called at module scope). Nests: an inner block's locale wraps the outer one
 * and hands it back on the way out.
 */
export const withDeviceLocale = (locale: string): void => {
  let restore: (() => void) | null = null

  beforeAll(() => {
    restore = installDeviceLocale(locale)
  })

  afterAll(() => {
    restore?.()
    restore = null
  })
}

/**
 * How `locale` groups `value`, read from the same ICU data as the code under
 * test. Assert against this instead of a literal whenever the locale's group
 * separator is one CLDR has moved: on this repo's node, fr-FR groups with
 * U+202F (narrow no-break space) while en-ZA still uses U+00A0, and fr-FR used
 * U+00A0 itself until CLDR 34. Locales whose separator is a plain "," or "."
 * are stable enough to assert literally, and doing so keeps at least one real
 * oracle in the suite.
 */
export const groupedInLocale = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale).format(value)
