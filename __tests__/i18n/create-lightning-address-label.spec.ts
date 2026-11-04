import fs from "fs"
import path from "path"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

const ENGLISH = "Create Lightning address"

const locales = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""))

const createAddressFor = (locale: string): unknown => {
  const raw = JSON.parse(
    fs.readFileSync(path.join(TRANSLATIONS_DIR, `${locale}.json`), "utf8"),
  )
  return raw.SettingsScreen?.createAddress
}

describe("SettingsScreen.createAddress", () => {
  it("reads 'Create Lightning address' in English", () => {
    loadLocale("en")

    expect(i18nObject("en").SettingsScreen.createAddress()).toBe(ENGLISH)
  })

  it("reads 'Crear dirección Lightning' in Spanish", () => {
    loadLocale("es")

    expect(i18nObject("es").SettingsScreen.createAddress()).toBe(
      "Crear dirección Lightning",
    )
  })

  locales.forEach((locale) => {
    it(`is translated and names Lightning in ${locale}`, () => {
      const value = createAddressFor(locale)

      expect(typeof value).toBe("string")
      expect(value).not.toBe(ENGLISH)
      expect(value).toContain("Lightning")
    })
  })
})
