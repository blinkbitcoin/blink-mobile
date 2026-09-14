import * as RNLocalize from "react-native-localize"

import { Locales } from "@app/i18n/i18n-types"
import { locales } from "@app/i18n/i18n-util"

export const matchOsLocaleToSupportedLocale = (
  localesFromOs: ReturnType<typeof RNLocalize.getLocales>,
): Locales => {
  const languageCodeFromOs = localesFromOs.map((osLocale) => osLocale.languageCode)
  let firstSupportedLocale: Locales = "en"
  for (const languageCode of languageCodeFromOs) {
    const match = locales.find((locale) => languageCode.startsWith(locale))
    if (match) {
      firstSupportedLocale = match
      break
    }
  }

  return firstSupportedLocale
}

export const detectDefaultLocale = (): Locales => {
  const localesFromOs = RNLocalize.getLocales()
  return matchOsLocaleToSupportedLocale(localesFromOs)
}

/**
 * The device's preferred currency, taken from the OS region and locale settings, so it
 * costs no permission and no network call. Undefined when the device names no currency the
 * backend can price, which leaves the caller on its own fallback.
 */
export const detectDefaultCurrency = (
  supportedCurrencyIds: readonly string[],
): string | undefined => {
  const currenciesFromOs = RNLocalize.getCurrencies()
  return currenciesFromOs.find((currencyId) => supportedCurrencyIds.includes(currencyId))
}

export const Languages = ["DEFAULT", ...locales] as const

export type Language = (typeof Languages)[number]

export const getLanguageFromString = (language?: string): Language => {
  if (!language) {
    return "DEFAULT"
  }

  const exactMatchLanguage = locales.find((locale) => locale === language)

  if (exactMatchLanguage) {
    return exactMatchLanguage
  }

  // previously we used the following values for setting the language sever side
  // ["DEFAULT", "en-US", "es-SV", "pt-BR", "fr-CA", "de-DE", "cs"]
  const approximateMatchLocale = locales.find((locale) =>
    locale.startsWith(language.split("-")[0]),
  )

  return approximateMatchLocale || "DEFAULT"
}

export const getLocaleFromLanguage = (language: Language): Locales => {
  if (language === "DEFAULT") {
    return detectDefaultLocale()
  }
  return language
}
