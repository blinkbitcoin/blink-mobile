import { i18nObject, locales } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const normalize = (label: string): string => label.trim().toLowerCase()

// Both buttons sit in one modal: when "Revoke" and its way out read the same, the user
// can't tell the destructive one apart. sk, cs, ar, hy and xh rendered "Revoke" with
// their "Cancel" word, and ms (Batal/Batalkan) and tr (İptal/İptal et) with a form of it
describe("revoke API key modal buttons", () => {
  locales.forEach((locale) => {
    describe(locale, () => {
      loadLocale(locale)
      const LL = i18nObject(locale)
      const revoke = normalize(LL.ApiScreen.revoke())

      it("labels Go back and Revoke differently", () => {
        expect(normalize(LL.ApiScreen.revokeGoBack())).not.toBe(revoke)
      })

      it("doesn't say Cancel for Revoke", () => {
        expect(revoke.startsWith(normalize(LL.common.cancel()))).toBe(false)
      })
    })
  })
})
