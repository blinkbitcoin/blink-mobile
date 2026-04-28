import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { Locales } from "@app/i18n/i18n-types"

const LOCALES: ReadonlyArray<Locales> = [
  "af",
  "ar",
  "ca",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "fr",
  "hr",
  "hu",
  "hy",
  "it",
  "ja",
  "lg",
  "ms",
  "nl",
  "pt",
  "qu",
  "ro",
  "sk",
  "sr",
  "sw",
  "th",
  "tr",
  "vi",
]

describe("locale parity for backup/restore i18n keys", () => {
  LOCALES.forEach((locale) => {
    describe(`locale: ${locale}`, () => {
      beforeAll(() => {
        loadLocale(locale)
      })

      it("exposes a non-empty RestoreScreen.invalidMnemonic string", () => {
        const LL = i18nObject(locale)
        const value = LL.RestoreScreen.invalidMnemonic()
        expect(typeof value).toBe("string")
        expect(value.length).toBeGreaterThan(0)
      })

      it("exposes a non-empty BackupScreen.ManualBackup.Phrase.headerTitle string", () => {
        const LL = i18nObject(locale)
        const value = LL.BackupScreen.ManualBackup.Phrase.headerTitle()
        expect(typeof value).toBe("string")
        expect(value.length).toBeGreaterThan(0)
      })
    })
  })
})
