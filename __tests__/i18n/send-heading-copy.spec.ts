import type { Locales } from "@app/i18n/i18n-types"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import id from "@app/i18n/raw-i18n/translations/id.json"
import xh from "@app/i18n/raw-i18n/translations/xh.json"

/**
 * The transaction detail heading for an outgoing payment, per locale. A send is not
 * always a spend (a transfer to yourself pays no one), so every locale uses its own
 * verb for "send" (blink-wip#426). Pinned through `i18nObject`, the same merge over `en`
 * the app renders from, so a spend verb, an untranslated English fallback or a deleted
 * key all fail, and a new locale is a type error until it is added here.
 */
const SENT_HEADING: Record<Locales, string> = {
  af: "Jy het gestuur",
  ar: "أرسلت",
  ca: "Has enviat",
  cs: "Odeslali jste",
  da: "Du sendte",
  de: "Du sendetest",
  el: "Έχετε στείλει",
  en: "You sent",
  es: "Enviaste",
  fr: "Vous avez envoyé",
  hr: "Poslali ste",
  hu: "Elküldött",
  hy: "Դուք ուղարկեցիք",
  it: "Hai inviato",
  ja: "送金完了",
  lg: "Osindise",
  ms: "Anda dah hantar",
  nl: "Je hebt verzonden",
  pt: "Você enviou",
  qu: "Apachirqanki",
  ro: "Ați trimis",
  sk: "Odoslali ste",
  sr: "Послали сте",
  sw: "Ulituma",
  th: "คุณได้ส่ง",
  tr: "Gönderdiniz",
  vi: "Bạn đã gửi",
}

describe("TransactionDetailScreen.sent", () => {
  ;(Object.entries(SENT_HEADING) as Array<[Locales, string]>).forEach(
    ([locale, expected]) => {
      it(`reads "${expected}" in ${locale}`, () => {
        loadLocale(locale)

        expect(i18nObject(locale).TransactionDetailScreen.sent()).toBe(expected)
      })
    },
  )
})

// Translated in Crowdin but not generated into `Locales`, so the app never renders them
// and `i18nObject` cannot load them. Pinned on the raw file so they are not left behind.
describe("TransactionDetailScreen.sent in unshipped translations", () => {
  const unshipped = [
    { locale: "id", raw: id, expected: "Anda mengirim" },
    { locale: "xh", raw: xh, expected: "Uthumele" },
  ]

  unshipped.forEach(({ locale, raw, expected }) => {
    it(`reads "${expected}" in ${locale}`, () => {
      expect(raw.TransactionDetailScreen.sent).toBe(expected)
    })
  })
})
