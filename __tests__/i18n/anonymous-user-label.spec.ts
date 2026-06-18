import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

describe("common.anonymousUser label", () => {
  it("reads 'Anon user' in English", () => {
    loadLocale("en")

    expect(i18nObject("en").common.anonymousUser()).toBe("Anon user")
  })

  it("reads 'Usuario Anon' in Spanish", () => {
    loadLocale("es")

    expect(i18nObject("es").common.anonymousUser()).toBe("Usuario Anon")
  })
})
