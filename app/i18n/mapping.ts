import "@formatjs/intl-getcanonicallocales/polyfill"
import "@formatjs/intl-locale/polyfill"
import "@formatjs/intl-numberformat/polyfill-force"
import "@formatjs/intl-relativetimeformat/polyfill"

import "@formatjs/intl-numberformat/locale-data/af"
import "@formatjs/intl-numberformat/locale-data/ar"
import "@formatjs/intl-numberformat/locale-data/ca"
import "@formatjs/intl-numberformat/locale-data/cs"
import "@formatjs/intl-numberformat/locale-data/da"
import "@formatjs/intl-numberformat/locale-data/de"
import "@formatjs/intl-numberformat/locale-data/en"
import "@formatjs/intl-numberformat/locale-data/el"
import "@formatjs/intl-numberformat/locale-data/es"
import "@formatjs/intl-numberformat/locale-data/fr"
import "@formatjs/intl-numberformat/locale-data/ja"
import "@formatjs/intl-numberformat/locale-data/hr"
import "@formatjs/intl-numberformat/locale-data/hu"
import "@formatjs/intl-numberformat/locale-data/hy"
import "@formatjs/intl-numberformat/locale-data/id"
import "@formatjs/intl-numberformat/locale-data/it"
import "@formatjs/intl-numberformat/locale-data/lg"
import "@formatjs/intl-numberformat/locale-data/nl"
import "@formatjs/intl-numberformat/locale-data/ms"
import "@formatjs/intl-numberformat/locale-data/pt"
import "@formatjs/intl-numberformat/locale-data/qu"
import "@formatjs/intl-numberformat/locale-data/ro"
import "@formatjs/intl-numberformat/locale-data/sk"
import "@formatjs/intl-numberformat/locale-data/sr"
import "@formatjs/intl-numberformat/locale-data/sw"
import "@formatjs/intl-numberformat/locale-data/th"
import "@formatjs/intl-numberformat/locale-data/tr"
import "@formatjs/intl-numberformat/locale-data/vi"
import "@formatjs/intl-numberformat/locale-data/xh"

import "@formatjs/intl-relativetimeformat/locale-data/af"
import "@formatjs/intl-relativetimeformat/locale-data/ar"
import "@formatjs/intl-relativetimeformat/locale-data/ca"
import "@formatjs/intl-relativetimeformat/locale-data/cs"
import "@formatjs/intl-relativetimeformat/locale-data/da"
import "@formatjs/intl-relativetimeformat/locale-data/de"
import "@formatjs/intl-relativetimeformat/locale-data/en"
import "@formatjs/intl-relativetimeformat/locale-data/el"
import "@formatjs/intl-relativetimeformat/locale-data/es"
import "@formatjs/intl-relativetimeformat/locale-data/fr"
import "@formatjs/intl-relativetimeformat/locale-data/ja"
import "@formatjs/intl-relativetimeformat/locale-data/hr"
import "@formatjs/intl-relativetimeformat/locale-data/hu"
import "@formatjs/intl-relativetimeformat/locale-data/hy"
import "@formatjs/intl-relativetimeformat/locale-data/it"
import "@formatjs/intl-relativetimeformat/locale-data/lg"
import "@formatjs/intl-relativetimeformat/locale-data/nl"
import "@formatjs/intl-relativetimeformat/locale-data/ms"
import "@formatjs/intl-relativetimeformat/locale-data/pt"
import "@formatjs/intl-relativetimeformat/locale-data/qu"
import "@formatjs/intl-relativetimeformat/locale-data/ro"
import "@formatjs/intl-relativetimeformat/locale-data/sk"
import "@formatjs/intl-relativetimeformat/locale-data/sr"
import "@formatjs/intl-relativetimeformat/locale-data/sw"
import "@formatjs/intl-relativetimeformat/locale-data/th"
import "@formatjs/intl-relativetimeformat/locale-data/tr"
import "@formatjs/intl-relativetimeformat/locale-data/vi"

// we don't use transfiex for this because we don't want the language to be translated.
// for instance, for French we want "Francais", not "French" or "ภาษาฝรั่งเศส"
export const LocaleToTranslateLanguageSelector = {
  af: "Afrikaans",
  ar: "العربية",
  ca: "Catalan",
  cs: "Česky",
  da: "Dansk",
  de: "Deutsch",
  en: "English",
  el: "Ελληνικά",
  es: "Español",
  fr: "Français",
  ja: "日本語",
  hr: "Hrvatski",
  hu: "Magyar",
  hy: "Հայերեն",
  it: "Italiano",
  lg: "Luganda", // "Ganda
  nl: "Nederlands",
  ms: "Bahasa Melayu",
  pt: "Português",
  qu: "Quechua",
  ro: "Română",
  sk: "Slovensky", 
  sr: "Српски", 
  sw: "KiSwahili", 
  th: "ไทย",
  tr: "Türkçe",
  vi: "Tiếng Việt",
} as const
